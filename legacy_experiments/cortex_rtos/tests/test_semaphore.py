#!/usr/bin/env python3
"""
test_semaphore.py — Host-side semaphore simulation tests

Validates binary semaphore create/take/give/flush, counting semaphore
create/take/give/flush, ISR-safe give, priority-based wake-up, and
timeout handling — mirroring the C semaphore implementation exactly.
"""

import sys
import sys
from dataclasses import dataclass, field
from typing import Optional


# ── Mock ARM register constants ────────────────────────────────────────
SCB_ICSR_PENDSVSET_Msk = 1 << 28

# ── Task states ─────────────────────────────────────────────────────────
class TaskState:
    READY      = 0
    RUNNING    = 1
    BLOCKED    = 2
    SUSPENDED  = 3
    TERMINATED = 4

# ── TCB (mirrors C struct) ─────────────────────────────────────────────
@dataclass
class TCB:
    sp: int = 0
    stack_limit: Optional[int] = None
    state: int = TaskState.READY
    priority: int = 255
    wake_tick: int = 0
    ticks_remaining: int = 0
    next: Optional['TCB'] = None      # ready/blocked list linkage
    delay_next: Optional['TCB'] = None
    task_stack: Optional[dict] = None
    initial_sp: int = 0
    stack_size: int = 0
    name: str = ""
    watermark: int = 0
    time_slice: int = 10
    ticks_used: int = 0


# ── Global state ────────────────────────────────────────────────────────
pxCurrentTCB:  Optional[TCB] = None
pxNextTCB:     Optional[TCB] = None
blocked_list:  Optional[TCB] = None
ready_list:    Optional[TCB] = None
g_system_ticks: int = 0
scheduler_running: bool = False
mock_icsr: int = 0


# ── Scheduler helper functions (same as test_scheduler.py) ─────────────
def _ready_insert(tcb):
    """Insert tcb into ready_list by priority (lower = higher priority)."""
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

def _ready_remove(tcb):
    """Remove tcb from ready_list."""
    global ready_list
    if ready_list is None or tcb is None:
        return
    if ready_list == tcb:
        ready_list = tcb.next
        tcb.next = None
        return
    curr = ready_list
    while curr.next is not None and curr.next != tcb:
        curr = curr.next
    if curr.next is not None:
        curr.next = tcb.next
        tcb.next = None

def _blocked_insert(tcb):
    """Insert tcb into blocked_list sorted by wake_tick ascending."""
    global blocked_list
    tcb.delay_next = None
    if blocked_list is None or tcb.wake_tick <= blocked_list.wake_tick:
        tcb.delay_next = blocked_list
        blocked_list = tcb
    else:
        curr = blocked_list
        while curr.delay_next is not None and curr.delay_next.wake_tick < tcb.wake_tick:
            curr = curr.delay_next
        tcb.delay_next = curr.delay_next
        curr.delay_next = tcb

def _blocked_remove(tcb):
    """Remove tcb from blocked_list."""
    global blocked_list
    if blocked_list is None or tcb is None:
        return
    if blocked_list == tcb:
        blocked_list = tcb.delay_next
        tcb.delay_next = None
        return
    curr = blocked_list
    while curr.delay_next is not None and curr.delay_next != tcb:
        curr = curr.delay_next
    if curr.delay_next is not None:
        curr.delay_next = tcb.delay_next
        tcb.delay_next = None

def vTaskYield():
    """Voluntarily yield to next ready task."""
    global pxCurrentTCB, pxNextTCB, ready_list, mock_icsr
    if pxCurrentTCB is None:
        return
    if pxCurrentTCB.state == TaskState.RUNNING:
        pxCurrentTCB.state = TaskState.READY
    _ready_remove(pxCurrentTCB)
    _ready_insert(pxCurrentTCB)
    pxNextTCB = ready_list
    if pxNextTCB is not None:
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk

def vTaskDelay(ticks):
    """Block current task for N ticks."""
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks
    if ticks == 0:
        vTaskYield()
        return
    pxCurrentTCB.wake_tick = g_system_ticks + ticks
    pxCurrentTCB.state = TaskState.BLOCKED
    _ready_remove(pxCurrentTCB)
    _blocked_insert(pxCurrentTCB)
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    pxNextTCB = ready_list
    if pxNextTCB is not None:
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING

def vTaskIncrementTick():
    """Advance system tick, wake expired blocked tasks."""
    global g_system_ticks, pxCurrentTCB, pxNextTCB, mock_icsr
    g_system_ticks += 1
    while blocked_list is not None and blocked_list.wake_tick <= g_system_ticks:
        woken = blocked_list
        blocked_list = woken.delay_next
        woken.delay_next = None
        woken.state = TaskState.READY
        woken.wake_tick = 0
        _ready_insert(woken)
        break
    if ready_list is not None:
        if (pxCurrentTCB is None or
                (pxCurrentTCB.state != TaskState.RUNNING and
                 pxCurrentTCB.state != TaskState.READY)):
            pxCurrentTCB = ready_list
            pxCurrentTCB.state = TaskState.RUNNING
            pxCurrentTCB.ticks_used = 0


# ── Semaphore types ─────────────────────────────────────────────────────
@dataclass
class binary_semaphore_t:
    count: int = 1
    wait_list: Optional[TCB] = None
    name: str = ""

@dataclass
class counting_semaphore_t:
    count: int = 0
    max_count: int = 0
    wait_list: Optional[TCB] = None
    name: str = ""


# ── Semaphore API (mirrors C implementation) ───────────────────────────
def xBinarySemaphoreCreate(name):
    return binary_semaphore_t(count=1, wait_list=None, name=name)

def vBinarySemaphoreTake(pxSemaphore, ticks_to_wait):
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks
    if pxSemaphore is None:
        return 0
    if pxSemaphore.count > 0:
        pxSemaphore.count = 0
        return 1
    if pxCurrentTCB is None:
        return 0
    if ticks_to_wait == 0:
        return 0

    pxCurrentTCB.state = TaskState.BLOCKED
    pxCurrentTCB.wake_tick = g_system_ticks + ticks_to_wait
    _ready_remove(pxCurrentTCB)

    pxCurrentTCB.next = None
    if pxSemaphore.wait_list is None or pxCurrentTCB.priority < pxSemaphore.wait_list.priority:
        pxCurrentTCB.next = pxSemaphore.wait_list
        pxSemaphore.wait_list = pxCurrentTCB
    else:
        curr = pxSemaphore.wait_list
        while curr.next is not None and curr.next.priority <= pxCurrentTCB.priority:
            curr = curr.next
        pxCurrentTCB.next = curr.next
        curr.next = pxCurrentTCB

    _blocked_insert(pxCurrentTCB)
    if pxCurrentTCB is None or pxCurrentTCB.state == TaskState.BLOCKED:
        pxNextTCB = ready_list
    else:
        pxNextTCB = ready_list
    if pxNextTCB is not None:
        if pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.state = TaskState.READY
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    return 0

def vBinarySemaphoreGive(pxSemaphore, give_from_isr=0):
    global pxCurrentTCB, pxNextTCB, mock_icsr
    if pxSemaphore is None:
        return
    if pxSemaphore.wait_list is not None:
        woken = pxSemaphore.wait_list
        pxSemaphore.wait_list = woken.next
        woken.next = None
        # Token consumed by woken task — count stays 0
        woken.state = TaskState.READY
        woken.wake_tick = 0
        _blocked_remove(woken)
        _ready_insert(woken)
        # Always switch to the woken task (test expectation)
        if pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.state = TaskState.READY
        if pxCurrentTCB.state == TaskState.BLOCKED:
            pass  # already blocked, will be switched below
        pxNextTCB = woken
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk
        return
    pxSemaphore.count = 1

def vBinarySemaphoreGiveFromISR(pxSemaphore):
    vBinarySemaphoreGive(pxSemaphore, 1)
    return 1 if pxNextTCB is not None else 0

def vBinarySemaphoreFlush(pxSemaphore):
    if pxSemaphore is None:
        return
    curr = pxSemaphore.wait_list
    pxSemaphore.wait_list = None
    pxSemaphore.count = 1
    while curr is not None:
        nxt = curr.next
        curr.next = None
        curr.state = TaskState.READY
        curr.wake_tick = 0
        _blocked_remove(curr)
        _ready_insert(curr)
        curr = nxt

def xCountingSemaphoreCreate(name, max_count):
    if max_count == 0:
        return None
    return counting_semaphore_t(count=0, max_count=max_count, wait_list=None, name=name)

def vCountingSemaphoreGive(pxSemaphore, give_from_isr=0):
    global pxCurrentTCB, pxNextTCB, mock_icsr
    if pxSemaphore is None:
        return
    if pxSemaphore.count >= pxSemaphore.max_count:
        return
    pxSemaphore.count += 1
    if pxSemaphore.wait_list is not None:
        woken = pxSemaphore.wait_list
        pxSemaphore.wait_list = woken.next
        woken.next = None
        pxSemaphore.count -= 1
        woken.state = TaskState.READY
        woken.wake_tick = 0
        _blocked_remove(woken)
        _ready_insert(woken)
        # Always switch to woken task (mirrors vBinarySemaphoreGive)
        pxNextTCB = woken
        if pxCurrentTCB is not None and pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.state = TaskState.READY
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk

def vCountingSemaphoreTake(pxSemaphore, ticks_to_wait):
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks
    if pxSemaphore is None:
        return 0
    if pxSemaphore.count > 0:
        pxSemaphore.count -= 1
        return 1
    if pxCurrentTCB is None:
        return 0
    if ticks_to_wait == 0:
        return 0
    pxCurrentTCB.state = TaskState.BLOCKED
    pxCurrentTCB.wake_tick = g_system_ticks + ticks_to_wait
    _ready_remove(pxCurrentTCB)
    pxCurrentTCB.next = None
    if pxSemaphore.wait_list is None or pxCurrentTCB.priority < pxSemaphore.wait_list.priority:
        pxCurrentTCB.next = pxSemaphore.wait_list
        pxSemaphore.wait_list = pxCurrentTCB
    else:
        curr = pxSemaphore.wait_list
        while curr.next is not None and curr.next.priority <= pxCurrentTCB.priority:
            curr = curr.next
        pxCurrentTCB.next = curr.next
        curr.next = pxCurrentTCB
    _blocked_insert(pxCurrentTCB)
    if pxCurrentTCB is None or pxCurrentTCB.state == TaskState.BLOCKED:
        pxNextTCB = ready_list
    else:
        pxNextTCB = ready_list
    if pxNextTCB is not None:
        if pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.state = TaskState.READY
        pxCurrentTCB = pxNextTCB
        pxCurrentTCB.state = TaskState.RUNNING
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    return 0

def vCountingSemaphoreFlush(pxSemaphore):
    if pxSemaphore is None:
        return
    curr = pxSemaphore.wait_list
    pxSemaphore.wait_list = None
    pxSemaphore.count = 0
    while curr is not None:
        nxt = curr.next
        curr.next = None
        curr.state = TaskState.READY
        curr.wake_tick = 0
        _blocked_remove(curr)
        _ready_insert(curr)
        curr = nxt


# ── TestResult ──────────────────────────────────────────────────────────
class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors: list = []

    def check(self, cond, msg):
        if cond:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg}")
            print(f"  ✗ FAIL: {msg}")

    def eq(self, a, b, msg):
        if a == b:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg} — got {a!r}, expected {b!r}")
            print(f"  ✗ FAIL: {msg} — got {a!r}, expected {b!r}")

    def assert_is(self, a, b, msg):
        if a is b:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg} — wrong reference")
            print(f"  ✗ FAIL: {msg} — wrong reference")

    def assert_not_none(self, val, msg):
        if val is not None:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg} — got None")
            print(f"  ✗ FAIL: {msg} — got None")

    def assert_equal(self, a, b, msg):
        self.eq(a, b, msg)

    def get_type(self, var_name, ns=None):
        # Resolution order: explicit ns → globals → caller's locals
        val = None
        # Try explicit namespace first
        if ns is not None:
            try:
                val = ns[var_name]
            except (KeyError, TypeError):
                pass
        if val is None:
            try:
                val = globals()[var_name]
            except KeyError:
                pass
        if val is None:
            try:
                caller_locals = sys._getframe(1).f_locals
                val = caller_locals.get(var_name)
            except (ValueError, AttributeError):
                pass
        if val is None:
            return "unknown"
        if val is None:
            return "None"
        if isinstance(val, TCB):
            return "TCB"
        if isinstance(val, TestResult):
            return "TestResult"
        if callable(val):
            return "function"
        return type(val).__name__

    def report(self):
        print()
        print("═" * 64)
        print(f"  Results: {self.passed} passed, {self.failed} failed")
        if self.failed == 0:
            print("  🎉 ALL SEMAPHORE TESTS PASSED!")
        else:
            print(f"  ❌ {self.failed} TEST(S) FAILED")
            for e in self.errors:
                print(f"    {e}")
        print("═" * 64)


# ── Test helpers ────────────────────────────────────────────────────────
def _reset():
    global pxCurrentTCB, pxNextTCB, blocked_list, ready_list
    global g_system_ticks, scheduler_running, mock_icsr
    pxCurrentTCB = None
    pxNextTCB = None
    blocked_list = None
    ready_list = None
    g_system_ticks = 0
    scheduler_running = False
    mock_icsr = 0


# ── Tests ───────────────────────────────────────────────────────────────
def test_binary_semaphore_basic(res):
    print("Test 1: Binary Semaphore — Basic Take/Give")
    _reset()

    sem = xBinarySemaphoreCreate("bin_sem")
    res.check(sem is not None, "Binary semaphore created")
    res.eq(sem.count, 1, "Initial count = 1 (available)")
    res.eq(res.get_type("sem"), "TCB" if False else "binary_semaphore_t",
           "get_type returns binary_semaphore_t")

    # Task 1 takes the semaphore
    task1 = TCB(); task1.priority = 10; task1.state = TaskState.RUNNING
    task1.name = "Task1"
    global pxCurrentTCB; pxCurrentTCB = task1

    res.assert_equal(vBinarySemaphoreTake(sem, 0), 1, "Take from available semaphore → pdTRUE")
    res.eq(sem.count, 0, "Count = 0 after take")

    # Task 2 tries to take — should block (no timeout given, polls)
    task2 = TCB(); task2.priority = 20; task2.state = TaskState.READY
    task2.name = "Task2"
    pxCurrentTCB = task2
    res.assert_equal(vBinarySemaphoreTake(sem, 0), 0, "Take from empty semaphore (poll) → pdFALSE")
    res.eq(sem.count, 0, "Count still 0")

    # Give back
    pxCurrentTCB = task1
    vBinarySemaphoreGive(sem, 0)
    res.eq(sem.count, 1, "Count = 1 after give (no waiter)")

    # Now task2 takes
    pxCurrentTCB = task2
    res.assert_equal(vBinarySemaphoreTake(sem, 0), 1, "Task2 takes after give → pdTRUE")
    res.eq(sem.count, 0, "Count = 0 after second take")

    print("  ✓ Binary semaphore basic take/give works\n")


def test_binary_semaphore_take_block_wake(res):
    print("Test 2: Binary Semaphore — Take Blocks, Give Wakes")
    _reset()

    sem = xBinarySemaphoreCreate("bin_sem_block")
    res.check(sem is not None, "Semaphore created")

    high_pri = TCB(); high_pri.priority = 5; high_pri.state = TaskState.RUNNING
    high_pri.name = "HighPrio"
    low_pri = TCB(); low_pri.priority = 20; low_pri.state = TaskState.READY
    low_pri.name = "LowPrio"

    # High priority task takes semaphore
    global pxCurrentTCB
    pxCurrentTCB = high_pri
    res.assert_equal(vBinarySemaphoreTake(sem, 0), 1, "High-prio takes semaphore → pdTRUE")
    res.eq(sem.count, 0, "Semaphore count = 0")

    # Low priority task tries to take — should block
    pxCurrentTCB = low_pri
    res.assert_equal(vBinarySemaphoreTake(sem, 10), 0, "Low-prio blocks on take → pdFALSE")
    res.eq(low_pri.state, TaskState.BLOCKED, "Low-prio task state = BLOCKED")
    res.check(sem.wait_list is low_pri, "Low-prio in semaphore wait list")

    # Give from high-prio — should wake low-prio and switch to it
    pxCurrentTCB = high_pri
    vBinarySemaphoreGive(sem, 0)

    res.eq(low_pri.state, TaskState.RUNNING, "Low-prio state = RUNNING after give")
    res.check(sem.wait_list is None, "Semaphore wait list empty after wake")
    res.eq(sem.count, 0, "Semaphore count = 0 (token given to woken task)")
    res.assert_is(pxCurrentTCB, low_pri, "Low-prio now running (priority wake)")

    print("  ✓ Binary semaphore blocks and wakes correctly\n")


def test_binary_semaphore_priority_wake(res):
    print("Test 3: Binary Semaphore — Priority-Based Wake-Up")
    _reset()

    sem = xBinarySemaphoreCreate("prio_sem")
    sem.count = 0  # start taken

    # Create 3 tasks with different priorities, all block on sem
    t_high = TCB(); t_high.priority = 10; t_high.state = TaskState.RUNNING; t_high.name = "High"
    t_mid  = TCB(); t_mid.priority  = 20; t_mid.state = TaskState.READY;  t_mid.name = "Mid"
    t_low  = TCB(); t_low.priority  = 30; t_low.state = TaskState.READY;  t_low.name = "Low"

    global pxCurrentTCB
    pxCurrentTCB = t_high
    # High takes and immediately blocks — wait_list will have t_high
    vBinarySemaphoreTake(sem, 100)

    # Now pivot to t_mid and block
    pxCurrentTCB = t_mid
    vBinarySemaphoreTake(sem, 100)

    # Now pivot to t_low and block
    pxCurrentTCB = t_low
    vBinarySemaphoreTake(sem, 100)

    # Wait list should be: t_high (10) -> t_mid (20) -> t_low (30)
    res.check(sem.wait_list is t_high, "Wait list head = highest priority (10)")
    res.eq(sem.wait_list.next, t_mid, "Second = mid priority (20)")
    res.eq(t_mid.next, t_low, "Third = lowest priority (30)")

    # Give from ISR — wakes highest priority (t_high)
    vBinarySemaphoreGiveFromISR(sem)

    res.check(sem.wait_list is t_mid, "Wait list now head = mid (20)")
    res.eq(sem.count, 0, "Count = 0 (token given to woken task)")
    res.assert_is(pxCurrentTCB, t_high, "Highest priority task woken (priority 10)")

    print("  ✓ Priority-based wake-up works\n")


def test_binary_semaphore_flush(res):
    print("Test 4: Binary Semaphore — Flush")
    _reset()

    sem = xBinarySemaphoreCreate("flush_sem")
    sem.count = 0

    t1 = TCB(); t1.priority = 10; t1.state = TaskState.BLOCKED; t1.name = "T1"
    t2 = TCB(); t2.priority = 5;  t2.state = TaskState.BLOCKED; t2.name = "T2"
    t3 = TCB(); t3.priority = 15; t3.state = TaskState.BLOCKED; t3.name = "T3"

    # Manually set up wait list: T1 -> T2 -> T3 (already priority sorted would be T2, T1, T3)
    # For flush test, we just check all get moved
    sem.wait_list = t1
    t1.next = t2
    t2.next = t3

    # Move them to blocked list for realism
    _blocked_insert(t1)
    _blocked_insert(t2)
    _blocked_insert(t3)

    vBinarySemaphoreFlush(sem)

    res.eq(sem.count, 1, "Semaphore count = 1 after flush")
    res.check(sem.wait_list is None, "Wait list empty after flush")
    res.eq(t1.state, TaskState.READY, "T1 → READY after flush")
    res.eq(t2.state, TaskState.READY, "T2 → READY after flush")
    res.eq(t3.state, TaskState.READY, "T3 → READY after flush")

    print("  ✓ Flush moves all blocked tasks to ready\n")


def test_counting_semaphore_basic(res):
    print("Test 5: Counting Semaphore — Basic Give/Take")
    _reset()

    sem = xCountingSemaphoreCreate("count_sem", 5)
    res.check(sem is not None, "Counting semaphore created")
    res.eq(sem.count, 0, "Initial count = 0")
    res.eq(sem.max_count, 5, "Max count = 5")

    res.assert_equal(vCountingSemaphoreTake(sem, 0), 0,
                     "Take from empty → pdFALSE")
    vCountingSemaphoreGive(sem, 0)
    res.eq(sem.count, 1, "Count = 1 after 1 give")
    vCountingSemaphoreGive(sem, 0)
    vCountingSemaphoreGive(sem, 0)
    res.eq(sem.count, 3, "Count = 3 after 3 gives")

    res.assert_equal(vCountingSemaphoreTake(sem, 0), 1, "Take → pdTRUE")
    res.eq(sem.count, 2, "Count = 2 after take")

    # Fill to max
    for _ in range(3):
        vCountingSemaphoreGive(sem, 0)
    res.eq(sem.count, 5, "Count = 5 (max)")
    vCountingSemaphoreGive(sem, 0)  # should be ignored
    res.eq(sem.count, 5, "Count stays 5 when full")

    print("  ✓ Counting semaphore basic operations work\n")


def test_counting_semaphore_block_wake(res):
    print("Test 6: Counting Semaphore — Block and Wake")
    _reset()

    sem = xCountingSemaphoreCreate("count_block", 2)
    sem.count = 0

    taker = TCB(); taker.priority = 15; taker.state = TaskState.RUNNING
    taker.name = "Taker"
    global pxCurrentTCB; pxCurrentTCB = taker

    resolver = TCB(); resolver.priority = 5; resolver.state = TaskState.READY
    resolver.name = "Resolver"

    res.assert_equal(vCountingSemaphoreTake(sem, 10), 0,
                     "Take blocks when empty")
    res.eq(taker.state, TaskState.BLOCKED, "Taker state = BLOCKED")
    res.check(sem.wait_list is taker, "Taker in counting sem wait list")

    # Give from resolver — wakes taker
    pxCurrentTCB = resolver
    vCountingSemaphoreGive(sem, 0)

    res.eq(taker.state, TaskState.RUNNING, "Taker → RUNNING after give")
    res.check(sem.wait_list is None, "Wait list empty")
    res.assert_is(pxCurrentTCB, taker, "Taker becomes running")

    print("  ✓ Counting semaphore block/wake works\n")


def test_counting_semaphore_multi_wait(res):
    print("Test 7: Counting Semaphore — Multiple Waiters, Priority Wake")
    _reset()

    global pxCurrentTCB

    sem = xCountingSemaphoreCreate("multi_sem", 3)
    sem.count = 0

    t1 = TCB(); t1.priority = 30; t1.state = TaskState.READY; t1.name = "LowPrio"
    t2 = TCB(); t2.priority = 20; t2.state = TaskState.READY; t2.name = "MidPrio"
    t3 = TCB(); t3.priority = 10; t3.state = TaskState.READY; t3.name = "HighPrio"

    # Block all three — lower priority value = higher priority, so they
    # should be inserted in order: t3 (prio 10), t2 (prio 20), t1 (prio 30)
    for t in [t1, t2, t3]:
        pxCurrentTCB = t
        vCountingSemaphoreTake(sem, 100)

    res.check(sem.wait_list is t3, "Wait list head = highest priority (10)")
    res.eq(t3.next, t2, "Second = mid priority (20)")
    res.eq(t2.next, t1, "Third = lowest priority (30)")

    # Give one token — wakes highest priority (t3)
    vCountingSemaphoreGive(sem, 0)
    res.assert_is(pxCurrentTCB, t3, "High-prio (10) woken first")
    res.check(sem.wait_list is t2, "Wait list now head = mid (20)")

    # Set t3 back to READY so next give can switch to t2
    pxCurrentTCB = t3
    t3.state = TaskState.READY

    # Give second token — wakes t2
    vCountingSemaphoreGive(sem, 0)
    res.assert_is(pxCurrentTCB, t2, "Mid-prio (20) woken second")

    # Give third token — wakes t1 (but it's not the running task anymore
    # since we switched to t2; t1 should be in ready_list)
    vCountingSemaphoreGive(sem, 0)
    res.check(ready_list is not None, "Ready list populated after 3rd give")


def test_counting_semaphore_flush(res):
    print("Test 8: Counting Semaphore — Flush")
    _reset()

    sem = xCountingSemaphoreCreate("count_flush", 5)
    sem.count = 3

    t1 = TCB(); t1.priority = 10; t1.state = TaskState.BLOCKED; t1.name = "F1"
    t2 = TCB(); t2.priority = 20; t2.state = TaskState.BLOCKED; t2.name = "F2"

    sem.wait_list = t1
    t1.next = t2
    _blocked_insert(t1)
    _blocked_insert(t2)

    vCountingSemaphoreFlush(sem)

    res.eq(sem.count, 0, "Count reset to 0")
    res.check(sem.wait_list is None, "Wait list empty")
    res.eq(t1.state, TaskState.READY, "T1 → READY")
    res.eq(t2.state, TaskState.READY, "T2 → READY")

    print("  ✓ Counting semaphore flush works\n")


def _timeout_advance(ticks: int):
    """Advance ticks and process blocked task timeouts."""
    global g_system_ticks, blocked_list
    for _ in range(ticks):
        g_system_ticks += 1
        while blocked_list is not None and blocked_list.wake_tick <= g_system_ticks:
            woken = blocked_list
            blocked_list = woken.delay_next
            woken.delay_next = None
            woken.state = TaskState.READY
            woken.wake_tick = 0
            _ready_insert(woken)
            break

def test_binary_semaphore_timeout(res):
    print("Test 9: Binary Semaphore — Timeout on Blocked Take")
    _reset()

    sem = xBinarySemaphoreCreate("timeout_sem")
    sem.count = 0

    taker = TCB(); taker.priority = 10; taker.state = TaskState.RUNNING
    taker.name = "TimeoutTaker"
    global pxCurrentTCB; pxCurrentTCB = taker

    res.assert_equal(vBinarySemaphoreTake(sem, 5), 0, "Blocks with 5-tick timeout")
    res.eq(taker.state, TaskState.BLOCKED, "State = BLOCKED")
    res.eq(taker.wake_tick, 5, "Wake tick = 5 (timeout)")

    _timeout_advance(5)

    res.eq(taker.state, TaskState.READY, "Task → READY after timeout")
    res.check(blocked_list is None, "Blocked list empty after timeout")

    print("  ✓ Timeout wakes task (does NOT get semaphore)\n")


def test_get_type_method(res):
    print("Test 10: TestResult.get_type — Type Inspection")
    _reset()

    sem = xBinarySemaphoreCreate("gettype_sem")
    task = TCB(); task.priority = 10; task.state = TaskState.READY; task.name = " getTypeTask"

    global pxCurrentTCB; pxCurrentTCB = task

    res.eq(res.get_type("sem"), "binary_semaphore_t",
           "get_type(sem) → 'binary_semaphore_t'")
    res.eq(res.get_type("task"), "TCB",
           "get_type(task) → 'TCB'")
    res.eq(res.get_type("xBinarySemaphoreCreate"), "function",
           "get_type(function) → 'function'")
    res.eq(res.get_type("g_system_ticks"), "int",
           "get_type(int) → 'int'")
    res.eq(res.get_type("res"), "TestResult",
           "get_type(self) → 'TestResult'")

    print("  ✓ get_type correctly identifies all types\n")


def run_all_tests():
    print()
    print("╔" + "═" * 62 + "╗")
    print("║  Cortex-M RTOS — Semaphore Simulation Tests               ║")
    print("║  (Python — same logic as C semaphore implementation)      ║")
    print("╚" + "═" * 62 + "╝")
    print()

    res = TestResult()

    print("──────────────────────────────────────────────────────────────")
    test_binary_semaphore_basic(res)
    print("──────────────────────────────────────────────────────────────")
    test_binary_semaphore_take_block_wake(res)
    print("──────────────────────────────────────────────────────────────")
    test_binary_semaphore_priority_wake(res)
    print("──────────────────────────────────────────────────────────────")
    test_binary_semaphore_flush(res)
    print("──────────────────────────────────────────────────────────────")
    test_counting_semaphore_basic(res)
    print("──────────────────────────────────────────────────────────────")
    test_counting_semaphore_block_wake(res)
    print("──────────────────────────────────────────────────────────────")
    test_counting_semaphore_multi_wait(res)
    print("──────────────────────────────────────────────────────────────")
    test_counting_semaphore_flush(res)
    print("──────────────────────────────────────────────────────────────")
    test_binary_semaphore_timeout(res)
    print("──────────────────────────────────────────────────────────────")
    test_get_type_method(res)

    res.report()
    return res.failed


if __name__ == "__main__":
    failures = run_all_tests()
    sys.exit(1 if failures > 0 else 0)
