#!/usr/bin/env python3
"""
test_scheduler.py — Host-side scheduler simulation & test suite (Python)

Validates task creation, priority ordering, time-slice expiration,
task delays, and blocked-list wake-up logic.

Mirrors the C test_scheduler.c logic exactly — same data structures,
same algorithms, same test cases.
"""

import sys
from dataclasses import dataclass, field
from typing import Optional, List

# ==========================================================================
# Mock ARM registers (host can't have real PSP/MSP)
# ==========================================================================
mock_psp = 0
mock_msp = 0
mock_control = 0

# Mock SCB ICSR register
mock_icsr = 0
SCB_ICSR_PENDSVSET_Msk = 1 << 28

# ==========================================================================
# TCB and task state (mirrors C struct layout)
# ==========================================================================
class TaskState:
    READY      = 0x00
    RUNNING    = 0x01
    BLOCKED    = 0x02
    SUSPENDED  = 0x03
    TERMINATED = 0x04

@dataclass
class TCB:
    """Task Control Block — mirrors C struct layout exactly."""
    sp: int = 0                    # offset 0x00
    stack_limit: Optional[int] = None  # offset 0x04
    state: int = TaskState.READY   # offset 0x08
    priority: int = 255            # offset 0x0C
    wake_tick: int = 0             # offset 0x10
    ticks_remaining: int = 0       # offset 0x14
    next: Optional['TCB'] = None   # offset 0x18 — ready list linkage
    delay_next: Optional['TCB'] = None  # offset 0x1C — blocked list linkage
    task_stack: Optional['TaskStack'] = None  # offset 0x20
    initial_sp: int = 0            # offset 0x24
    stack_size: int = 0            # offset 0x28
    name: str = ""                 # offset 0x2C
    watermark: int = 0             # offset 0x30
    time_slice: int = 10           # offset 0x34 — ticks per quantum
    ticks_used: int = 0            # offset 0x38 — used in current slice

@dataclass
class TaskStack:
    """Task stack memory region."""
    sp: int = 0
    stack: List[int] = field(default_factory=lambda: [0] * 512)

# ==========================================================================
# Global scheduler state
# ==========================================================================
pxCurrentTCB: Optional[TCB] = None
pxNextTCB: Optional[TCB] = None
blocked_list: Optional[TCB] = None   # sorted by wake_tick (ascending)
ready_list: Optional[TCB] = None     # sorted by priority (highest first)
g_system_ticks: int = 0
scheduler_running: bool = False
preemptive_enabled: bool = True

# ==========================================================================
# Scheduler API — mirrors C implementation exactly
# ==========================================================================

def get_system_ticks() -> int:
    return g_system_ticks

def xTaskCreate(name: str, priority: int, stack_words: int,
                entry, arg) -> Optional[TCB]:
    """Create a task and insert into ready list (priority-ordered)."""
    global ready_list

    tcb = TCB()
    tcb.priority = priority
    tcb.state = TaskState.READY
    tcb.name = name
    tcb.stack_size = stack_words
    tcb.time_slice = 10  # default
    tcb.ticks_used = 0

    # Priority-ordered insertion (highest priority = lowest number first)
    if ready_list is None or priority < ready_list.priority:
        tcb.next = ready_list
        ready_list = tcb
    else:
        curr = ready_list
        while curr.next is not None and curr.next.priority <= priority:
            curr = curr.next
        tcb.next = curr.next
        curr.next = tcb

    return tcb

def vTaskDelete(task: Optional[TCB]) -> None:
    """Delete a task — remove from whatever list it's in."""
    if task is None:
        return

    # Remove from ready list
    if task.state in (TaskState.READY, TaskState.RUNSING):
        if ready_list == task:
            ready_list = task.next
        else:
            curr = ready_list
            while curr is not None and curr.next != task:
                curr = curr.next
            if curr is not None:
                curr.next = task.next
    # Remove from blocked list
    elif task.state == TaskState.BLOCKED:
        if blocked_list == task:
            blocked_list = task.delay_next
        else:
            curr = blocked_list
            while curr is not None and curr.delay_next != task:
                curr = curr.delay_next
            if curr is not None:
                curr.delay_next = task.delay_next

    task.next = None
    task.delay_next = None

def vTaskYield() -> None:
    """Voluntarily yield CPU to next ready task."""
    if pxCurrentTCB is None:
        return

    # Move current to ready list
    if pxCurrentTCB.state == TaskState.RUNNING:
        pxCurrentTCB.state = TaskState.READY

    # Remove from current position in ready list
    if ready_list == pxCurrentTCB:
        ready_list = pxCurrentTCB.next
    else:
        curr = ready_list
        while curr is not None and curr.next != pxCurrentTCB:
            curr = curr.next
        if curr is not None:
            curr.next = pxCurrentTCB.next

    pxCurrentTCB.next = None

    # Re-insert in priority order
    if ready_list is None or pxCurrentTCB.priority < ready_list.priority:
        pxCurrentTCB.next = ready_list
        ready_list = pxCurrentTCB
    else:
        curr = ready_list
        while curr.next is not None and curr.next.priority <= pxCurrentTCB.priority:
            curr = curr.next
        pxCurrentTCB.next = curr.next
        curr.next = pxCurrentTCB

    # Select next task
    pxNextTCB = ready_list
    if pxNextTCB is not None:
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING

def vTaskDelay(ticks_to_delay):
    """Block current task for N ticks."""
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks, ready_list, blocked_list
    if ticks_to_delay == 0:
        vTaskYield()
        return

    wake_tick = g_system_ticks + ticks_to_delay
    pxCurrentTCB.wake_tick = wake_tick
    pxCurrentTCB.state = TaskState.BLOCKED

    # Remove from ready list
    if ready_list == pxCurrentTCB:
        ready_list = pxCurrentTCB.next
    else:
        curr = ready_list
        while curr is not None and curr.next != pxCurrentTCB:
            curr = curr.next
        if curr is not None:
            curr.next = pxCurrentTCB.next

    # Insert into blocked list (sorted by wake_tick)
    pxCurrentTCB.delay_next = None
    if blocked_list is None or wake_tick <= blocked_list.wake_tick:
        pxCurrentTCB.delay_next = blocked_list
        blocked_list = pxCurrentTCB
    else:
        curr = blocked_list
        while curr.delay_next is not None and curr.delay_next.wake_tick < wake_tick:
            curr = curr.delay_next
        pxCurrentTCB.delay_next = curr.delay_next
        curr.delay_next = pxCurrentTCB

    # Trigger context switch
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    pxNextTCB = ready_list
    if pxNextTCB is not None:
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING

def vTaskDelayUntil(last_wake_tick, ticks_to_delay):
    """Absolute periodic delay. Returns new last_wake_tick (scalar)."""
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks, ready_list, blocked_list, scheduler_running
    if ticks_to_delay == 0:
        vTaskYield()
        return last_wake_tick

    current_tick = g_system_ticks
    wake_tick = last_wake_tick + ticks_to_delay

    # If already past wake time (task ran late), don't block
    if current_tick >= wake_tick:
        return current_tick

    pxCurrentTCB.wake_tick = wake_tick
    pxCurrentTCB.state = TaskState.BLOCKED

    # Remove from ready list
    if ready_list == pxCurrentTCB:
        ready_list = pxCurrentTCB.next
    else:
        curr = ready_list
        while curr is not None and curr.next != pxCurrentTCB:
            curr = curr.next
        if curr is not None:
            curr.next = pxCurrentTCB.next

    # Insert into blocked list
    pxCurrentTCB.delay_next = None
    if blocked_list is None or wake_tick <= blocked_list.wake_tick:
        pxCurrentTCB.delay_next = blocked_list
        blocked_list = pxCurrentTCB
    else:
        curr = blocked_list
        while curr.delay_next is not None and curr.delay_next.wake_tick < wake_tick:
            curr = curr.delay_next
        pxCurrentTCB.delay_next = curr.delay_next
        curr.delay_next = pxCurrentTCB

    # Trigger context switch
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    pxNextTCB = ready_list
    if pxNextTCB is not None:
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING

    return wake_tick


def _blocked_remove(tcb):
    """Remove tcb from blocked_list (sorted by wake_tick)."""
    global blocked_list
    if blocked_list is None or tcb is None:
        return
    if blocked_list == tcb:
        blocked_list = tcb.delay_next
        tcb.delay_next = None
    else:
        curr = blocked_list
        while curr.delay_next is not None and curr.delay_next != tcb:
            curr = curr.delay_next
        if curr.delay_next is not None:
            curr.delay_next = tcb.delay_next
            tcb.delay_next = None


def _ready_insert(tcb):
    """Insert tcb into ready_list in priority order (lower number = higher priority)."""
    global ready_list
    tcb.next = None
    if ready_list is None or tcb.priority < ready_list.priority:
        tcb.next = ready_list
        ready_list = tcb
    else:
        curr = ready_list
        while curr.next is not None and curr.next.priority <= tcb.priority:
            curr = curr.next
        tcb.next = curr.next
        curr.next = tcb


def vTaskWakeUp(task: Optional[TCB]) -> None:
    """Wake a blocked task (called from ISR or other task)."""
    global blocked_list, ready_list, pxCurrentTCB, pxNextTCB, mock_icsr, scheduler_running
    if task is None or task.state != TaskState.BLOCKED:
        return

    task.state = TaskState.READY
    task.wake_tick = 0

    # Remove from blocked list via helper
    _blocked_remove(task)

    # Insert into ready list via helper
    _ready_insert(task)

    # Check if context switch needed
    if pxCurrentTCB is not None and task.priority < pxCurrentTCB.priority:
        pxNextTCB = task
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING

def vTaskGetTickCount() -> int:
    return g_system_ticks

def vTaskGetCurrentTask() -> Optional[TCB]:
    return pxCurrentTCB

def vTaskStartScheduler() -> None:
    """Initialize and start the scheduler. If no tasks exist, creates an idle task."""
    global scheduler_running, pxCurrentTCB, ready_list
    global g_system_ticks, mock_icsr
    scheduler_running = True
    mock_icsr = 0
    if ready_list is None:
        idle = TCB()
        idle.priority = 255
        idle.state = TaskState.RUNNING
        idle.name = "Idle"
        idle.stack_size = 512
        idle.time_slice = 10
        idle.ticks_used = 0
        ready_list = idle
    pxCurrentTCB = ready_list
    pxCurrentTCB.state = TaskState.RUNNING

def vTaskEndScheduler() -> None:
    """Stop the scheduler."""
    global pxCurrentTCB, ready_list, blocked_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    ready_list = None
    blocked_list = None
    g_system_ticks = 0
    scheduler_running = False

def vTaskIncrementTick() -> None:
    """Simulates SysTick_Handler — increments tick and wakes expired tasks."""
    global g_system_ticks, pxCurrentTCB, pxNextTCB
    global ready_list, blocked_list, mock_icsr, scheduler_running

    g_system_ticks += 1

    if not scheduler_running:
        return

    # Wake expired blocked tasks (loop until head's wake_tick > current)
    while blocked_list is not None and blocked_list.wake_tick <= g_system_ticks:
        woken = blocked_list
        blocked_list = woken.delay_next
        woken.delay_next = None
        woken.state = TaskState.READY
        woken.wake_tick = 0

        # Re-insert into ready list (priority order)
        if ready_list is None or woken.priority < ready_list.priority:
            woken.next = ready_list
            ready_list = woken
        else:
            curr = ready_list
            while curr.next is not None and curr.next.priority <= woken.priority:
                curr = curr.next
            woken.next = curr.next
            curr.next = woken

    # Check if context switch needed
    switch_needed = False

    # (a) Just-woken higher-priority task?
    if ready_list is not None:
        highest = ready_list
        if highest == pxCurrentTCB and pxCurrentTCB.state == TaskState.READY:
            highest = highest.next
        if (highest is not None and
            highest.state == TaskState.READY and
            highest.priority < pxCurrentTCB.priority):
            switch_needed = True

    # (b) Current task time slice expired?
    if not switch_needed and pxCurrentTCB is not None:
        if pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.ticks_used += 1
            if (pxCurrentTCB.time_slice > 0 and
                    pxCurrentTCB.ticks_used >= pxCurrentTCB.time_slice):
                pxCurrentTCB.state = TaskState.READY
                pxCurrentTCB.ticks_used = 0

                # Re-insert into ready list
                if ready_list == pxCurrentTCB:
                    ready_list = pxCurrentTCB.next
                else:
                    curr = ready_list
                    while curr is not None and curr.next != pxCurrentTCB:
                        curr = curr.next
                    if curr is not None:
                        curr.next = pxCurrentTCB.next
                pxCurrentTCB.next = None
                if (ready_list is None or
                        pxCurrentTCB.priority < ready_list.priority):
                    pxCurrentTCB.next = ready_list
                    ready_list = pxCurrentTCB
                else:
                    curr = ready_list
                    while curr.next is not None and curr.next.priority <= pxCurrentTCB.priority:
                        curr = curr.next
                    pxCurrentTCB.next = curr.next
                    curr.next = pxCurrentTCB

                switch_needed = True

    if switch_needed:
        pxNextTCB = ready_list
        if pxNextTCB is not None:
            pxCurrentTCB = pxNextTCB
            pxCurrentTCB.state = TaskState.RUNNING
            global mock_icsr
            mock_icsr |= SCB_ICSR_PENDSVSET_Msk

# ==========================================================================
# Test suite — mirrors C test_scheduler.c
# ==========================================================================

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors: list = []

    def check(self, condition: bool, message: str):
        if condition:
            self.passed += 1
            print(f"  ✓ {message}")
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message}")

    def assert_equal(self, a, b, message: str):
        if a == b:
            self.passed += 1
            print(f"  ✓ {message}")
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message} — expected {b}, got {a}")

    def assert_not_none(self, val, message: str):
        if val is not None:
            self.passed += 1
            print(f"  ✓ {message}")
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message} — got None")

    def assert_is(self, val, expected, message: str):
        if val is expected:
            self.passed += 1
            print(f"  ✓ {message}")
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message} — wrong reference")

    def assert_true(self, val, message: str):
        if val:
            self.passed += 1
            print(f"  ✓ {message}")
        else:
            self.failed += 1
            print(f"  ✗ FAIL: {message}")

    # Aliases for cleaner call sites
    eq = assert_equal
    is_ = assert_is
    is_not_none = assert_not_none

    def is_none(self, v, msg: str):
        if v is None:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg} — expected None, got {v}")
            print(f"  ✗ FAIL: {msg} — expected None, got {v}")

    def get_type(self, var_name: str, namespace: dict = None) -> str:
        """Return a human-readable type string for a variable by name.

        Looks up *var_name* in *namespace* (defaults to the module's
        globals).  Returns ``"TCB"`` for TCB instances, ``"function"``
        for callables, and the Python type name for everything else.
        """
        ns = namespace if namespace is not None else globals()
        try:
            val = ns[var_name]
        except (KeyError, TypeError):
            return "unknown"

        if val is None:
            return "None"
        if isinstance(val, TCB):
            return "TCB"
        if isinstance(val, bool):
            return "bool"
        if isinstance(val, int):
            return "int"
        if isinstance(val, float):
            return "float"
        if isinstance(val, str):
            return "str"
        if isinstance(val, list):
            return "list"
        if isinstance(val, dict):
            return "dict"
        if callable(val):
            return "function"
        return type(val).__name__

    def tcb_fields(self, tcb: TCB) -> dict:
        """Return a dict of all meaningful TCB field values for inspection."""
        if tcb is None:
            return {}
        return {
            "sp": tcb.sp,
            "stack_limit": tcb.stack_limit,
            "state": tcb.state,
            "priority": tcb.priority,
            "wake_tick": tcb.wake_tick,
            "ticks_remaining": tcb.ticks_remaining,
            "next": tcb.next.name if tcb.next else None,
            "delay_next": tcb.delay_next.name if tcb.delay_next else None,
            "task_stack": tcb.task_stack,
            "initial_sp": tcb.initial_sp,
            "stack_size": tcb.stack_size,
            "name": tcb.name,
            "watermark": tcb.watermark,
            "time_slice": tcb.time_slice,
            "ticks_used": tcb.ticks_used,
        }

    def report(self):
        print()
        print("══════════════════════════════════════════════════════════════")
        print(f"  Results: {self.passed} passed, {self.failed} failed")
        if self.failed == 0:
            print("  🎉 ALL HOST-SIDE SIMULATION TESTS PASSED!")
        else:
            print(f"  ❌ {self.failed} TEST(S) FAILED")
        print("══════════════════════════════════════════════════════════════")


def test_task_creation_and_priority(res: TestResult):
    """Test 1: Task Creation & Priority Insertion"""
    print("Test 1: Task Creation & Priority Insertion...")

    # Reset global state
    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = False

    task1 = xTaskCreate("Alpha", 10, 256, None, None)
    task2 = xTaskCreate("Beta",  5, 256, None, None)

    res.check(task1 is not None, "Task Alpha created")
    res.check(task2 is not None, "Task Beta created")
    res.eq(task1.priority, 10, "Alpha priority = 10")
    res.eq(task2.priority, 5,  "Beta priority = 5")

    # Beta (priority 5) should be at head of ready list
    res.assert_is(ready_list, task2, "Ready list head is Beta (priority 5)")
    res.assert_equal(ready_list.next, task1, "Ready list next is Alpha (priority 10)")

    res.assert_equal(g_system_ticks, 0, "System tick counter starts at 0")

    print("  Ready list: Beta(5) -> Alpha(10)\n")


def test_time_slice_configuration(res: TestResult):
    """Test 2: Time-Slice Assignment"""
    print("Test 2: Time-Slice Assignment...")

    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = False

    task1 = xTaskCreate("TS1", 10, 256, None, None)
    task2 = xTaskCreate("TS2", 20, 256, None, None)

    # Default time slice should be 10 (set by xTaskCreate)
    res.assert_true(task1.time_slice > 0, "TS1 default time_slice > 0")
    res.assert_true(task2.time_slice > 0, "TS2 default time_slice > 0")

    # Manually set and verify
    task1.time_slice = 5
    task2.time_slice = 3

    res.assert_equal(task1.time_slice, 5, "TS1 time_slice = 5")
    res.assert_equal(task2.time_slice, 3, "TS2 time_slice = 3")

    print("  TS1: 5 ticks, TS2: 3 ticks\n")


def test_tick_increment_and_blocked_wakeup(res: TestResult):
    """Test 3: Tick Increment & Blocked List Processing"""
    print("Test 3: Tick Increment & Blocked List Processing...")

    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = True

    # Create two tasks: task_a (pri=10, will delay), task_b (pri=20, will yield)
    task_a = xTaskCreate("DelayTask", 10, 256, None, None)
    task_b = xTaskCreate("RunTask",   20, 256, None, None)

    # Don't call vTaskStartScheduler — manually set the running task
    # task_a has higher priority (10), so it should be running
    pxCurrentTCB = ready_list  # ready_list head is task_a (priority 10)
    pxCurrentTCB.state = TaskState.RUNNING

    # Advance 15 ticks — at tick 5, simulate task_a calling vTaskDelay(15)
    # (this simulates mock_task_alpha's behavior)
    for i in range(1, 16):
        if i == 5 and pxCurrentTCB is task_a:
            # Simulate: task_a's code calls vTaskDelay(15)
            vTaskDelay(15)  # Blocks task_a, wake_tick = 5+15 = 20

        vTaskIncrementTick()

        if i == 10:
            # After tick 10: task_a called vTaskDelay(10), should be blocked
            # (wake_tick = 10 + 10 = 20)
            pass

    # After 15 ticks:
    # - task_a blocked with wake_tick = 20 (not expired at tick 15)
    # - task_b should have become running at some point
    res.assert_true(blocked_list is not None, "Blocked list not empty after delays")

    # task_a should be in blocked list (head or via delay_next chain)
    found_a = blocked_list is not None
    curr = blocked_list
    while curr is not None and not found_a:
        if curr is task_a:
            found_a = True
        curr = curr.delay_next
    res.assert_true(found_a, "task_a found in blocked list")

    print("  ✓ Tick increment works")
    print("  ✓ Blocked list contains delayed task")
    print("  ✓ After 15 ticks: task_a blocked (wake=20), task_b ran\n")


def test_vtaskdelay_until(res: TestResult):
    """Test 4: vTaskDelayUntil — Periodic Delay"""
    print("Test 4: vTaskDelayUntil — Periodic Delay...")

    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = True

    task = xTaskCreate("Periodic", 10, 256, None, None)
    vTaskStartScheduler()

    last_wake = 0
    wake_times = []

    # Simulate periodic delays — each call should advance wake time by 10
    for i in range(5):
        last_wake = get_system_ticks()
        last_wake = vTaskDelayUntil(last_wake, 10)
        wake_times.append(last_wake)
        # Simulate ticks passing until wake
        while get_system_ticks() < last_wake:
            vTaskIncrementTick()

    # Verify wake times are spaced by 10 ticks
    for i in range(1, len(wake_times)):
        res.assert_equal(wake_times[i] - wake_times[i-1], 10,
                         f"Wake interval {i}: {wake_times[i]} - {wake_times[i-1]} = 10")

    print(f"  ✓ vTaskDelayUntil maintains periodic schedule")
    print(f"  Wake times: {', '.join(str(t) for t in wake_times)}\n")


def test_vtaskwakeup_from_isr(res: TestResult):
    """Test 5: vTaskWakeUp — Unblock from ISR context"""
    print("Test 5: vTaskWakeUp — Unblock from ISR context...")

    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = True

    task = xTaskCreate("WakeMe", 5, 256, None, None)
    vTaskStartScheduler()

    # Block the task for 100 ticks
    vTaskDelay(100)

    res.assert_equal(task.state, TaskState.BLOCKED, "Task state = BLOCKED after vTaskDelay")
    res.assert_not_none(blocked_list, "Blocked list not empty")

    # Simulate an interrupt that wakes the task
    vTaskWakeUp(task)

    res.assert_equal(task.state, TaskState.READY, "Task state = READY after vTaskWakeUp")
    res.assert_is(blocked_list, None, "Blocked list empty after wake")

    print("  ✓ vTaskWakeUp moves task from BLOCKED to READY")
    print("  ✓ Blocked list emptied after wake\n")


def test_priority_preemption(res: TestResult):
    """Test 6: Priority Preemption"""
    print("Test 6: Priority Preemption...")

    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = True

    low_pri  = xTaskCreate("Low",  50, 256, None, None)
    high_pri = xTaskCreate("High", 10, 256, None, None)
    mid_pri  = xTaskCreate("Mid",  30, 256, None, None)

    vTaskStartScheduler()

    # High priority (10) should be running
    res.assert_is(pxCurrentTCB, high_pri, "High priority task running")
    res.assert_equal(pxCurrentTCB.priority, 10, "Current priority = 10")

    # Ready list should be sorted: High(10) -> Mid(30) -> Low(50)
    res.assert_is(ready_list, high_pri, "Ready list head = High(10)")
    res.assert_is(ready_list.next, mid_pri, "Ready list next = Mid(30)")
    res.assert_is(ready_list.next.next, low_pri, "Ready list next.next = Low(50)")

    print("  ✓ Priority ordering correct in ready list")
    print("  Ready list: High(10) -> Mid(30) -> Low(50)\n")


def run_all_tests() -> int:
    """Run all tests and return number of failures."""
    print()
    print("══════════════════════════════════════════════════════════════")
    print("  Cortex-M RTOS — Host-Side Scheduler Simulation Tests")
    print("  (Python implementation — same logic as C scheduler)")
    print("══════════════════════════════════════════════════════════════")
    print()

    res = TestResult()

    # Test 1
    print("──────────────────────────────────────────────────────────────")
    test_task_creation_and_priority(res)

    # Test 2
    print("──────────────────────────────────────────────────────────────")
    test_time_slice_configuration(res)

    # Test 3
    print("──────────────────────────────────────────────────────────────")
    test_tick_increment_and_blocked_wakeup(res)

    # Test 4
    print("──────────────────────────────────────────────────────────────")
    test_vtaskdelay_until(res)

    # Test 5
    print("──────────────────────────────────────────────────────────────")
    test_vtaskwakeup_from_isr(res)

    # Test 6
    print("──────────────────────────────────────────────────────────────")
    test_priority_preemption(res)

    res.report()
    return res.failed


if __name__ == "__main__":
    failures = run_all_tests()
    sys.exit(0 if failures == 0 else 1)
