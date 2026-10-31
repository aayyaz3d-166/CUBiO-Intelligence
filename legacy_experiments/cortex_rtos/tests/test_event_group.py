#!/usr/bin/env python3
"""
test_event_group.py — Host-side event group simulation tests

Validates 32-bit event group bitmasks: xEventGroupCreate, xEventGroupDelete,
xEventGroupSetBits, xEventGroupSetBitsFromISR, xEventGroupClearBits,
xEventGroupClearBitsFromISR, xEventGroupWaitBits, xEventGroupSync.

Mirrors the C event_group.c implementation exactly.
"""

import sys
from dataclasses import dataclass
from typing import Optional

SCB_ICSR_PENDSVSET_Msk = 1 << 28

# ---------------------------------------------------------------------------
# Event group flag constants (mirror C)
# ---------------------------------------------------------------------------
EVENT_WAIT_FOR_ALL_BITS = 0x01   # AND: all bits must be set
EVENT_CLEAR_ON_EXIT     = 0x02   # Clear bits on exit from wait
EVENT_DO_NOT_CLEAR      = 0x00

# Lock types (mirror C)
LOCK_NONE    = 0
LOCK_EVENT_GROUP = 9   # task blocked on event group wait


class TaskState:
    READY      = 0
    RUNNING    = 1
    BLOCKED    = 2
    SUSPENDED  = 3
    TERMINATED = 4


@dataclass
class TCB:
    sp: int = 0
    stack_limit: Optional[int] = None
    state: int = TaskState.READY
    priority: int = 255
    wake_tick: int = 0
    ticks_remaining: int = 0
    next: Optional['TCB'] = None
    delay_next: Optional['TCB'] = None
    task_stack: Optional[dict] = None
    initial_sp: int = 0
    stack_size: int = 0
    name: str = ""
    watermark: int = 0
    time_slice: int = 10
    ticks_used: int = 0
    effective_priority: int = 0

    # Event group wait-list linkage
    event_group_next: Optional['TCB'] = None

    # Lock fields
    lock_type: int = LOCK_NONE
    lock_arg: Optional[int] = None
    lock_extra: Optional[int] = None


# ---------------------------------------------------------------------------
# Global scheduler state
# ---------------------------------------------------------------------------
pxCurrentTCB: Optional[TCB] = None
pxNextTCB: Optional[TCB] = None
blocked_list: Optional[TCB] = None
ready_list: Optional[TCB] = None
g_system_ticks: int = 0
scheduler_running: bool = False
mock_icsr: int = 0


def _ready_insert(tcb):
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


def vTaskDelete(task: Optional[TCB]) -> None:
    """Delete a task — remove from whatever list it's in."""
    if task is None:
        return
    if task.state in (TaskState.READY, TaskState.RUNNING):
        if ready_list == task:
            ready_list = task.next
        else:
            curr = ready_list
            while curr is not None and curr.next != task:
                curr = curr.next
            if curr is not None:
                curr.next = task.next
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


def xTaskCreate(name, priority, stack_words, entry, arg):
    global ready_list
    tcb = TCB()
    tcb.priority = priority
    tcb.effective_priority = priority
    tcb.state = TaskState.READY
    tcb.name = name
    tcb.stack_size = stack_words
    tcb.ticks_used = 0
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


def vTaskDelay(ticks):
    global pxCurrentTCB, pxNextTCB, mock_icsr, g_system_ticks
    if ticks == 0:
        if pxCurrentTCB is not None and pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.state = TaskState.READY
            _ready_remove(pxCurrentTCB)
            _ready_insert(pxCurrentTCB)
            pxNextTCB = ready_list
            if pxNextTCB is not None:
                pxCurrentTCB = pxNextTCB
                pxCurrentTCB.state = TaskState.RUNNING
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk
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


def vTaskYield():
    global pxCurrentTCB, pxNextTCB, mock_icsr
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


def vTaskStartScheduler():
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
        ready_list = idle
    pxCurrentTCB = ready_list
    pxCurrentTCB.state = TaskState.RUNNING


def vTaskEndScheduler():
    global pxCurrentTCB, ready_list, blocked_list, g_system_ticks, scheduler_running
    pxCurrentTCB = None
    ready_list = None
    blocked_list = None
    g_system_ticks = 0
    scheduler_running = False


def vTaskIncrementTick():
    global g_system_ticks, pxCurrentTCB, pxNextTCB
    global ready_list, blocked_list, mock_icsr, scheduler_running
    g_system_ticks += 1
    if not scheduler_running:
        return
    while blocked_list is not None and blocked_list.wake_tick <= g_system_ticks:
        woken = blocked_list
        blocked_list = woken.delay_next
        woken.delay_next = None
        woken.state = TaskState.READY
        woken.wake_tick = 0
        _ready_insert(woken)
    switch_needed = False
    if ready_list is not None:
        highest = ready_list
        if highest == pxCurrentTCB and pxCurrentTCB.state == TaskState.READY:
            highest = highest.next
        if (highest is not None and
                highest.state == TaskState.READY and
                highest.priority < pxCurrentTCB.priority):
            switch_needed = True
    if not switch_needed and pxCurrentTCB is not None:
        if pxCurrentTCB.state == TaskState.RUNNING:
            pxCurrentTCB.ticks_used += 1
            if (pxCurrentTCB.time_slice > 0 and
                    pxCurrentTCB.ticks_used >= pxCurrentTCB.time_slice):
                pxCurrentTCB.state = TaskState.READY
                pxCurrentTCB.ticks_used = 0
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


# ---------------------------------------------------------------------------
# Event group object (mirror C event_group_t)
# ---------------------------------------------------------------------------

class EventBits_t:
    """Fake: we use plain int for event bits in Python sim."""
    pass


def xEventGroupCreate():
    """Create an event group. Returns handle or None."""
    eg = {
        'uxEventBits': 0,
        'xWaitList': None,
    }
    return eg


def vEventGroupDelete(xEventGroup):
    """Delete event group, wake all waiters."""
    if xEventGroup is None:
        return
    # Wake all waiters
    while xEventGroup['xWaitList'] is not None:
        woken = xEventGroup['xWaitList']
        xEventGroup['xWaitList'] = woken.event_group_next
        woken.event_group_next = None
        woken.state = TaskState.READY
        woken.lock_type = LOCK_NONE
        woken.lock_arg = None
        woken.lock_extra = None
        woken.wake_tick = 0
        _ready_insert(woken)
    # In sim, just discard the dict


def _add_waiter(xEventGroup, pxTCB):
    """Insert task into event group wait list (priority-ordered)."""
    if xEventGroup['xWaitList'] is None:
        xEventGroup['xWaitList'] = pxTCB
        pxTCB.event_group_next = None
        return
    if pxTCB.priority < xEventGroup['xWaitList'].priority:
        pxTCB.event_group_next = xEventGroup['xWaitList']
        xEventGroup['xWaitList'] = pxTCB
        return
    walker = xEventGroup['xWaitList']
    while walker.event_group_next is not None and walker.event_group_next.priority <= pxTCB.priority:
        walker = walker.event_group_next
    pxTCB.event_group_next = walker.event_group_next
    walker.event_group_next = pxTCB


def _remove_waiter(xEventGroup, pxTCB):
    if xEventGroup['xWaitList'] is None:
        return
    if xEventGroup['xWaitList'] == pxTCB:
        xEventGroup['xWaitList'] = pxTCB.event_group_next
        pxTCB.event_group_next = None
        return
    walker = xEventGroup['xWaitList']
    while walker.event_group_next is not None and walker.event_group_next != pxTCB:
        walker = walker.event_group_next
    if walker.event_group_next == pxTCB:
        walker.event_group_next = pxTCB.event_group_next
        pxTCB.event_group_next = None


def _wake_waiter(xEventGroup, pxTCB):
    """Wake a single waiter: remove from EG wait list, make ready, switch if needed."""
    _remove_waiter(xEventGroup, pxTCB)
    pxTCB.state = TaskState.READY
    pxTCB.lock_type = LOCK_NONE
    pxTCB.lock_arg = None
    pxTCB.lock_extra = None
    pxTCB.wake_tick = 0
    _ready_insert(pxTCB)
    # Unconditional switch to woken task (highest-priority waiter)
    global pxCurrentTCB
    current = pxCurrentTCB
    if current is not None and current.state == TaskState.RUNNING:
        current.state = TaskState.READY
    pxCurrentTCB = pxTCB
    pxTCB.state = TaskState.RUNNING
    global mock_icsr
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk


def xEventGroupSetBits(xEventGroup, uxBitsToSet):
    """Set bits, wake matching waiters. Returns previous bits."""
    if xEventGroup is None:
        return 0
    prev = xEventGroup['uxEventBits']
    xEventGroup['uxEventBits'] |= uxBitsToSet

    # Check all waiters
    walker = xEventGroup['xWaitList']
    while walker is not None:
        nxt = walker.event_group_next
        bits_waiting = walker.lock_arg if walker.lock_arg is not None else 0
        flags = walker.lock_extra if walker.lock_extra is not None else 0
        notify = False
        if (flags & EVENT_WAIT_FOR_ALL_BITS) != 0:
            if (xEventGroup['uxEventBits'] & bits_waiting) == bits_waiting:
                notify = True
        else:
            if (xEventGroup['uxEventBits'] & bits_waiting) != 0:
                notify = True
        if notify:
            _wake_waiter(xEventGroup, walker)
        walker = nxt
    return prev


def xEventGroupSetBitsFromISR(xEventGroup, uxBitsToSet, pxHigherPriorityTaskWoken):
    """ISR-safe set bits. Returns previous bits."""
    if xEventGroup is None:
        return 0
    prev = xEventGroup['uxEventBits']
    xEventGroup['uxEventBits'] |= uxBitsToSet
    walker = xEventGroup['xWaitList']
    while walker is not None:
        nxt = walker.event_group_next
        bits_waiting = walker.lock_arg if walker.lock_arg is not None else 0
        flags = walker.lock_extra if walker.lock_extra is not None else 0
        notify = False
        if (flags & EVENT_WAIT_FOR_ALL_BITS) != 0:
            if (xEventGroup['uxEventBits'] & bits_waiting) == bits_waiting:
                notify = True
        else:
            if (xEventGroup['uxEventBits'] & bits_waiting) != 0:
                notify = True
        if notify:
            _wake_waiter(xEventGroup, walker)
            if pxHigherPriorityTaskWoken is not None:
                pxHigherPriorityTaskWoken[0] = 1
        walker = nxt
    return prev


def xEventGroupClearBits(xEventGroup, uxBitsToClear):
    """Clear bits (does NOT wake waiters). Returns previous bits."""
    if xEventGroup is None:
        return 0
    prev = xEventGroup['uxEventBits']
    xEventGroup['uxEventBits'] &= ~uxBitsToClear
    return prev


def xEventGroupClearBitsFromISR(xEventGroup, uxBitsToClear):
    """ISR-safe clear bits. Returns previous bits."""
    if xEventGroup is None:
        return 0
    prev = xEventGroup['uxEventBits']
    xEventGroup['uxEventBits'] &= ~uxBitsToClear
    return prev


def xEventGroupWaitBits(xEventGroup, uxBitsToWaitFor, xFlags, pxEventGroupValue, xTicksToWait):
    """Wait for bits. Returns pdPASS/pdFAIL."""
    if xEventGroup is None:
        return 0
    current = pxCurrentTCB
    if current is None:
        return 0
    uxCurrentBits = xEventGroup['uxEventBits']

    # Check if condition already met
    condition_met = False
    if (xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0:
        if (uxCurrentBits & uxBitsToWaitFor) == uxBitsToWaitFor:
            condition_met = True
    else:
        if (uxCurrentBits & uxBitsToWaitFor) != 0:
            condition_met = True

    if condition_met:
        if pxEventGroupValue is not None:
            pxEventGroupValue[0] = uxCurrentBits
        if (xFlags & EVENT_CLEAR_ON_EXIT) != 0:
            xEventGroup['uxEventBits'] &= ~uxBitsToWaitFor
        return 1  # pdPASS

    if xTicksToWait == 0:
        if pxEventGroupValue is not None:
            pxEventGroupValue[0] = uxCurrentBits
        return 0  # pdFAIL

    # Block — remove from ready list first
    current = pxCurrentTCB
    if current is None:
        return 0
    _ready_remove(current)
    current.state = TaskState.BLOCKED
    current.lock_type = LOCK_EVENT_GROUP
    current.lock_arg = uxBitsToWaitFor
    current.lock_extra = xFlags
    current.wake_tick = g_system_ticks + xTicksToWait
    _add_waiter(xEventGroup, current)
    global mock_icsr
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    return 0


def xEventGroupSync(xEventGroup, uxBitsToSet, uxBitsToWaitFor, xFlags, xTicksToWait):
    """Atomic set + wait + optional clear. Returns pdPASS/pdFAIL."""
    if xEventGroup is None:
        return 0
    # Step 1: set bits
    xEventGroup['uxEventBits'] |= uxBitsToSet
    # Step 2: check condition
    condition_met = False
    if (xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0:
        if (xEventGroup['uxEventBits'] & uxBitsToWaitFor) == uxBitsToWaitFor:
            condition_met = True
    else:
        if (xEventGroup['uxEventBits'] & uxBitsToWaitFor) != 0:
            condition_met = True
    if condition_met:
        if (xFlags & EVENT_CLEAR_ON_EXIT) != 0:
            xEventGroup['uxEventBits'] &= ~uxBitsToWaitFor
        return 1
    if xTicksToWait == 0:
        return 0
    # Block — remove from ready list first
    current = pxCurrentTCB
    if current is None:
        return 0
    _ready_remove(current)
    current.state = TaskState.BLOCKED
    current.lock_type = LOCK_EVENT_GROUP
    current.lock_arg = uxBitsToWaitFor
    current.lock_extra = xFlags
    current.wake_tick = g_system_ticks + xTicksToWait
    _add_waiter(xEventGroup, current)
    global mock_icsr
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    return 0


# ---------------------------------------------------------------------------
# Test infrastructure
# ---------------------------------------------------------------------------

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

    def assert_equal(self, a, b, msg):
        self.eq(a, b, msg)

    def assert_true(self, val, msg):
        if val:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg}")
            print(f"  ✗ FAIL: {msg}")

    def assert_false(self, val, msg):
        if not val:
            self.passed += 1
            print(f"  ✓ {msg}")
        else:
            self.failed += 1
            self.errors.append(f"FAIL: {msg}")
            print(f"  ✗ FAIL: {msg}")

    def get_type(self, var_name, ns=None):
        val = None
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
        if isinstance(val, TCB):
            return "TCB"
        if isinstance(val, dict):
            return "event_group_t"
        if isinstance(val, bool):
            return "bool"
        if isinstance(val, int):
            return "int"
        if isinstance(val, str):
            return "str"
        if callable(val):
            return "function"
        return type(val).__name__

    def report(self):
        print()
        print("═" * 64)
        print(f"  Results: {self.passed} passed, {self.failed} failed")
        if self.failed == 0:
            print("  🎉 ALL EVENT GROUP TESTS PASSED!")
        else:
            print(f"  ❌ {self.failed} TEST(S) FAILED")
            for e in self.errors:
                print(f"    {e}")
        print("═" * 64)


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


# ---------------------------------------------------------------------------
# 55 Tests
# ---------------------------------------------------------------------------

def test_eg_01_create(res):
    """Test 1: xEventGroupCreate returns valid handle"""
    _reset()
    eg = xEventGroupCreate()
    res.check(eg is not None, "Event group created")
    res.eq(eg['uxEventBits'], 0, "Initial bits = 0")
    res.assert_is(eg['xWaitList'], None, "No waiters initially")


def test_eg_02_set_bits_basic(res):
    """Test 2: xEventGroupSetBits sets bits"""
    _reset()
    eg = xEventGroupCreate()
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T1", 10, 256, None, None)

    prev = xEventGroupSetBits(eg, 0x0F)
    res.eq(prev, 0, "Previous bits = 0")
    res.eq(eg['uxEventBits'], 0x0F, "Bits now = 0x0F")


def test_eg_03_set_bits_or(res):
    """Test 3: xEventGroupSetBits ORs bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0A
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T2", 10, 256, None, None)

    prev = xEventGroupSetBits(eg, 0x05)
    res.eq(prev, 0x0A, "Previous = 0x0A")
    res.eq(eg['uxEventBits'], 0x0F, "0x0A | 0x05 = 0x0F")


def test_eg_04_set_bits_preserves(res):
    """Test 4: Existing bits not cleared by set"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0xF0
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T3", 10, 256, None, None)

    xEventGroupSetBits(eg, 0x0F)
    res.eq(eg['uxEventBits'], 0xFF, "All bits set: 0xF0 | 0x0F = 0xFF")


def test_eg_05_set_bits_null(res):
    """Test 5: NULL event group → returns 0"""
    _reset()
    prev = xEventGroupSetBits(None, 0x10)
    res.eq(prev, 0, "NULL → 0")


def test_eg_06_clear_bits_basic(res):
    """Test 6: xEventGroupClearBits clears bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0xFF
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T4", 10, 256, None, None)

    prev = xEventGroupClearBits(eg, 0x0F)
    res.eq(prev, 0xFF, "Previous = 0xFF")
    res.eq(eg['uxEventBits'], 0xF0, "Bits cleared: 0xFF & ~0x0F = 0xF0")


def test_eg_07_clear_bits_not_set(res):
    """Test 7: Clearing unset bits is harmless"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T5", 10, 256, None, None)

    prev = xEventGroupClearBits(eg, 0xFF)
    res.eq(prev, 0, "Previous = 0")
    res.eq(eg['uxEventBits'], 0, "Still 0")


def test_eg_08_clear_bits_returns_prev(res):
    """Test 8: Clear bits returns previous value"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x55
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T6", 10, 256, None, None)

    prev = xEventGroupClearBits(eg, 0x55)
    res.eq(prev, 0x55, "Previous = 0x55")
    res.eq(eg['uxEventBits'], 0, "Cleared to 0")


def test_eg_09_clear_bits_null(res):
    """Test 9: NULL event group → returns 0"""
    _reset()
    prev = xEventGroupClearBits(None, 0x10)
    res.eq(prev, 0, "NULL → 0")


def test_eg_10_wait_bits_immediate(res):
    """Test 10: Wait bits returns immediately when condition met"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0F
    task = xTaskCreate("T7", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x0F, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 1, "Wait returns pdPASS (immediate)")
    res.eq(out[0], 0x0F, "Output value = 0x0F")
    res.eq(eg['uxEventBits'], 0x0F, "Bits unchanged (no clear)")


def test_eg_11_wait_bits_clear_on_exit(res):
    """Test 11: Wait bits with clear-on-exit clears bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0F
    task = xTaskCreate("T8", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x0F, EVENT_CLEAR_ON_EXIT, out, 0)
    res.eq(ret, 1, "Wait returns pdPASS")
    res.eq(out[0], 0x0F, "Output = 0x0F")
    res.eq(eg['uxEventBits'], 0, "Bits cleared")


def test_eg_12_wait_bits_timeout(res):
    """Test 12: Wait bits returns pdFAIL when timeout and no match"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T9", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x0F, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "Wait returns pdFAIL (no bits, non-blocking)")
    res.eq(out[0], 0, "Output = 0")
    res.eq(task.state, TaskState.READY, "Task not blocked")


def test_eg_13_wait_bits_or_any(res):
    """Test 13: Wait bits OR — any matching bit satisfies"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x02  # only bit 1 set
    task = xTaskCreate("T10", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x03, EVENT_DO_NOT_CLEAR, out, 0)  # wait for bits 0 or 1
    res.eq(ret, 1, "Wait returns pdPASS (bit 1 matches)")
    res.eq(out[0], 0x02, "Output = current bits (0x02)")


def test_eg_14_wait_bits_and_all(res):
    """Test 14: Wait bits AND — all bits must be set"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x02  # only bit 1 set
    task = xTaskCreate("T11", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x03, EVENT_WAIT_FOR_ALL_BITS | EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "Wait returns pdFAIL (bit 0 not set)")
    res.eq(eg['uxEventBits'], 0x02, "Bits unchanged")


def test_eg_15_wait_bits_and_met(res):
    """Test 15: Wait bits AND — all bits set → success"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x03  # both bits 0 and 1 set
    task = xTaskCreate("T12", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x03, EVENT_WAIT_FOR_ALL_BITS | EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 1, "Wait returns pdPASS (both bits set)")
    res.eq(out[0], 0x03, "Output = 0x03")


def test_eg_16_wait_bits_block_wake(res):
    """Test 16: Wait bits blocks, then set bits wakes task"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T13", 10, 256, None, None)
    task.state = TaskState.READY  # ensure not already blocked
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(ret, 0, "Wait returns pdFAIL (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "Task blocked on EG")

    # Now set the bit
    xEventGroupSetBits(eg, 0x01)
    res.eq(task.state, TaskState.RUNNING, "Task woken by set bits")
    res.eq(eg['uxEventBits'], 0x01, "Bits = 0x01")


def test_eg_17_wait_bits_clear_on_exit_after_wake(res):
    """Test 17: Wait bits with clear-on-exit, after wake clears bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x03
    task = xTaskCreate("T14", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x01, EVENT_CLEAR_ON_EXIT, out, 0)
    res.eq(ret, 1, "Wait returns pdPASS")
    res.eq(out[0], 0x03, "Output = 0x03")
    res.eq(eg['uxEventBits'], 0x02, "Bit 0 cleared, bit 1 remains")


def test_eg_18_set_bits_wakes_waiter(res):
    """Test 18: Set bits wakes a task waiting for those bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T15", 10, 256, None, None)
    task.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = task

    # Block on wait
    out = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(task.state, TaskState.BLOCKED, "Task blocked")

    # Set bits from another context
    prev = xEventGroupSetBits(eg, 0x01)
    res.eq(prev, 0, "Previous bits = 0")
    res.eq(task.state, TaskState.RUNNING, "Task woken")
    res.eq(eg['uxEventBits'], 0x01, "Bits = 0x01")


def test_eg_19_set_bits_does_not_wake_non_matching(res):
    """Test 19: Set bits that don't match waiter's mask doesn't wake"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T16", 10, 256, None, None)
    task.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = task

    # Wait for bit 0
    out = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(task.state, TaskState.BLOCKED, "Task blocked waiting for bit 0")

    # Set bit 1 (not what waiter wants)
    xEventGroupSetBits(eg, 0x02)
    res.eq(task.state, TaskState.BLOCKED, "Task still blocked (bit 1 doesn't match)")
    res.eq(eg['uxEventBits'], 0x02, "Bits = 0x02")


def test_eg_20_set_bits_from_isr_basic(res):
    """Test 20: xEventGroupSetBitsFromISR sets bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T17", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    prev = xEventGroupSetBitsFromISR(eg, 0x0F, hpw)
    res.eq(prev, 0, "Previous = 0")
    res.eq(eg['uxEventBits'], 0x0F, "Bits = 0x0F")
    res.eq(hpw[0], 0, "hpw not set (no waiter)")


def test_eg_21_set_bits_from_isr_wake(res):
    """Test 21: xEventGroupSetBitsFromISR wakes waiter and sets hpw"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T18", 10, 256, None, None)
    task.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(task.state, TaskState.BLOCKED, "Task blocked")

    hpw = [0]
    prev = xEventGroupSetBitsFromISR(eg, 0x01, hpw)
    res.eq(prev, 0, "Previous = 0")
    res.eq(task.state, TaskState.RUNNING, "Task woken by ISR set")
    res.eq(hpw[0], 1, "hpw set")


def test_eg_22_set_bits_from_isr_null(res):
    """Test 22: xEventGroupSetBitsFromISR NULL → 0"""
    _reset()
    hpw = [0]
    prev = xEventGroupSetBitsFromISR(None, 0x01, hpw)
    res.eq(prev, 0, "NULL → 0")


def test_eg_23_clear_bits_from_isr_basic(res):
    """Test 23: xEventGroupClearBitsFromISR clears bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0xFF
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T19", 10, 256, None, None)

    prev = xEventGroupClearBitsFromISR(eg, 0x0F)
    res.eq(prev, 0xFF, "Previous = 0xFF")
    res.eq(eg['uxEventBits'], 0xF0, "Cleared to 0xF0")


def test_eg_24_clear_bits_from_isr_null(res):
    """Test 24: xEventGroupClearBitsFromISR NULL → 0"""
    _reset()
    prev = xEventGroupClearBitsFromISR(None, 0x01)
    res.eq(prev, 0, "NULL → 0")


def test_eg_25_delete_wakes_waiters(res):
    """Test 25: vEventGroupDelete wakes all waiting tasks"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task1 = xTaskCreate("T20a", 10, 256, None, None)
    task2 = xTaskCreate("T20b", 20, 256, None, None)
    task1.state = TaskState.READY
    task2.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = task1

    out = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(task1.state, TaskState.BLOCKED, "Task1 blocked")

    pxCurrentTCB = task2
    out2 = [0]
    xEventGroupWaitBits(eg, 0x02, EVENT_DO_NOT_CLEAR, out2, 10)
    res.eq(task2.state, TaskState.BLOCKED, "Task2 blocked")

    vEventGroupDelete(eg)
    res.eq(task1.state, TaskState.READY, "Task1 woken by delete")
    res.eq(task2.state, TaskState.READY, "Task2 woken by delete")


def test_eg_26_delete_null(res):
    """Test 26: vEventGroupDelete NULL is safe"""
    _reset()
    vEventGroupDelete(None)  # should not crash
    res.check(True, "Delete NULL is safe")


def test_eg_27_sync_basic(res):
    """Test 27: xEventGroupSync sets, waits, returns immediately"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T21", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xEventGroupSync(eg, 0x01, 0x01, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret, 1, "Sync returns pdPASS (condition met after set)")
    res.eq(eg['uxEventBits'], 0x01, "Bits = 0x01 (set, not cleared)")


def test_eg_28_sync_clear_on_exit(res):
    """Test 28: xEventGroupSync with clear-on-exit clears bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T22", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xEventGroupSync(eg, 0x01, 0x01, EVENT_CLEAR_ON_EXIT, 0)
    res.eq(ret, 1, "Sync returns pdPASS")
    res.eq(eg['uxEventBits'], 0, "Bits cleared after sync")


def test_eg_29_sync_timeout(res):
    """Test 29: xEventGroupSync returns pdFAIL on timeout"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T23", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Set bit 0, wait for both 0 and 1 (AND semantics, timeout)
    ret = xEventGroupSync(eg, 0x01, 0x03, EVENT_WAIT_FOR_ALL_BITS | EVENT_DO_NOT_CLEAR, 10)
    res.eq(ret, 0, "Sync returns pdFAIL (bits 0x03 not met)")
    res.eq(task.state, TaskState.BLOCKED, "Task blocked")


def test_eg_30_sync_and(res):
    """Test 30: xEventGroupSync with AND — both bits must be set"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T24", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Set bit 0, wait for both 0 and 1 — AND semantics
    ret = xEventGroupSync(eg, 0x01, 0x03, EVENT_WAIT_FOR_ALL_BITS | EVENT_DO_NOT_CLEAR, 10)
    res.eq(ret, 0, "Sync returns pdFAIL (bits 0x03 not met)")
    res.eq(task.state, TaskState.BLOCKED, "Task blocked")


def test_eg_31_sync_and_met(res):
    """Test 31: xEventGroupSync AND — all bits set → success"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T25", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Set bits 0 and 1, wait for both
    ret = xEventGroupSync(eg, 0x03, 0x03, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret, 1, "Sync returns pdPASS (both bits set)")
    res.eq(eg['uxEventBits'], 0x03, "Bits = 0x03")


def test_eg_32_sync_or(res):
    """Test 32: xEventGroupSync OR — any bit satisfies"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T26", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xEventGroupSync(eg, 0x01, 0x03, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret, 1, "Sync returns pdPASS (bit 0 matches OR)")


def test_eg_33_sync_null(res):
    """Test 33: xEventGroupSync NULL → pdFAIL"""
    _reset()
    ret = xEventGroupSync(None, 0x01, 0x01, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_eg_34_wait_bits_null(res):
    """Test 34: xEventGroupWaitBits NULL → pdFAIL"""
    _reset()
    out = [0]
    ret = xEventGroupWaitBits(None, 0x01, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_eg_35_wait_bits_no_current_task(res):
    """Test 35: xEventGroupWaitBits with no current task → pdFAIL"""
    _reset()
    eg = xEventGroupCreate()
    global pxCurrentTCB; pxCurrentTCB = None
    out = [0]
    ret = xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "No current task → pdFAIL")
    pxCurrentTCB = xTaskCreate("T27", 10, 256, None, None)  # restore


def test_eg_36_multiple_waiters_same_bits(res):
    """Test 36: Two tasks wait on same bit; set wakes highest priority first"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    high = xTaskCreate("High", 5, 256, None, None)   # higher priority (lower number)
    low  = xTaskCreate("Low",  15, 256, None, None)  # lower priority
    high.state = TaskState.READY
    low.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = high

    out1 = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out1, 10)
    res.eq(high.state, TaskState.BLOCKED, "High blocked")

    pxCurrentTCB = low
    out2 = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out2, 10)
    res.eq(low.state, TaskState.BLOCKED, "Low blocked")

    # Set bit — wakes highest priority (High)
    xEventGroupSetBits(eg, 0x01)
    res.eq(high.state, TaskState.RUNNING, "High woken first")
    res.eq(low.state, TaskState.BLOCKED, "Low still blocked")


def test_eg_37_set_bits_after_wake_preserves_bits(res):
    """Test 37: Setting bits after wake doesn't retroactively wake"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T28", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Wait with timeout, times out
    out = [0]
    ret = xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(ret, 0, "Wait returns pdFAIL (no bits)")

    # Now set bits — task is no longer waiting, so no wake
    xEventGroupSetBits(eg, 0x01)
    res.eq(task.state, TaskState.READY, "Task not blocked (timeout returned)")


def test_eg_38_wait_bits_output_unchanged_on_fail(res):
    """Test 38: Wait bits output = current bits on timeout fail"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0A
    task = xTaskCreate("T29", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "Wait returns pdFAIL")
    res.eq(out[0], 0x0A, "Output = current bits (0x0A) even on fail")


def test_eg_39_event_group_independent_of_tasks(res):
    """Test 39: Event group bits are independent of task lifecycle"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x55
    res.eq(eg['uxEventBits'], 0x55, "Bits persist independent of tasks")

    task = xTaskCreate("T30", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task
    vTaskDelete(task)
    res.eq(eg['uxEventBits'], 0x55, "Bits unchanged after task deletion")


def test_eg_40_clear_bits_then_set(res):
    """Test 40: Clear then set restores bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0xFF
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T31", 10, 256, None, None)

    xEventGroupClearBits(eg, 0xFF)
    res.eq(eg['uxEventBits'], 0, "Cleared to 0")

    xEventGroupSetBits(eg, 0xAA)
    res.eq(eg['uxEventBits'], 0xAA, "Set to 0xAA")


def test_eg_41_set_bits_returns_full_prev(res):
    """Test 41: Set bits returns full previous 32-bit value"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0xAAAAAAAA
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T32", 10, 256, None, None)

    prev = xEventGroupSetBits(eg, 0x55555555)
    res.eq(prev, 0xAAAAAAAA, "Previous = 0xAAAAAAAA (full 32-bit)")
    res.eq(eg['uxEventBits'], 0xFFFFFFFF, "OR → 0xFFFFFFFF")


def test_eg_42_clear_bits_returns_full_prev(res):
    """Test 42: Clear bits returns full previous value"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x12345678
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T33", 10, 256, None, None)

    prev = xEventGroupClearBits(eg, 0x00005678)
    res.eq(prev, 0x12345678, "Previous = 0x12345678")
    res.eq(eg['uxEventBits'], 0x12340000, "Cleared")


def test_eg_43_wait_bits_partial_clear(res):
    """Test 43: Clear-on-exit only clears requested bits"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0F
    task = xTaskCreate("T34", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x03, EVENT_CLEAR_ON_EXIT, out, 0)
    res.eq(ret, 1, "Wait returns pdPASS")
    res.eq(out[0], 0x0F, "Output = 0x0F")
    res.eq(eg['uxEventBits'], 0x0C, "Bits 0-1 cleared, bits 2-3 remain")


def test_eg_44_set_bits_from_isr_preserves_prev(res):
    """Test 44: ISR set bits returns previous value correctly"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x11111111
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T35", 10, 256, None, None)

    hpw = [0]
    prev = xEventGroupSetBitsFromISR(eg, 0x00000001, hpw)
    res.eq(prev, 0x11111111, "Previous = 0x11111111")
    res.eq(eg['uxEventBits'], 0x11111112, "Bit 0 set")


def test_eg_45_sync_sets_before_wait(res):
    """Test 45: Sync sets bits before checking wait condition"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T36", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Wait for bit 0, but set bit 0 in the sync
    ret = xEventGroupSync(eg, 0x01, 0x01, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret, 1, "Sync returns pdPASS")
    res.eq(eg['uxEventBits'], 0x01, "Bits = 0x01 (set by sync)")


def test_eg_46_sync_with_clear_then_set(res):
    """Test 46: Sync with clear-on-exit, then set again"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T37", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xEventGroupSync(eg, 0x01, 0x01, EVENT_CLEAR_ON_EXIT, 0)
    res.eq(ret, 1, "Sync returns pdPASS")
    res.eq(eg['uxEventBits'], 0, "Cleared after sync")

    xEventGroupSetBits(eg, 0x02)
    res.eq(eg['uxEventBits'], 0x02, "Set to 0x02")


def test_eg_47_wait_bits_with_zero_wait_for_all(res):
    """Test 47: Wait bits AND with 0 bits to wait → immediate success"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T38", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x00, EVENT_WAIT_FOR_ALL_BITS | EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 1, "Wait with 0 bits AND → immediate pdPASS")
    res.eq(out[0], 0, "Output = 0")


def test_eg_48_wait_bits_zero_or(res):
    """Test 48: Wait bits OR with 0 bits → immediate fail (no bit matches 0)"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T39", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupWaitBits(eg, 0x00, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "Wait with 0 bits OR → pdFAIL (no bits to match)")
    res.eq(out[0], 0, "Output = 0")


def test_eg_49_set_bits_wakes_all_matching_waiters(res):
    """Test 49: Set bits wakes ALL waiters whose mask matches"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    t1 = xTaskCreate("T40a", 10, 256, None, None)
    t2 = xTaskCreate("T40b", 20, 256, None, None)
    t1.state = TaskState.READY
    t2.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = t1

    out1 = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out1, 10)
    res.eq(t1.state, TaskState.BLOCKED, "T1 blocked")

    pxCurrentTCB = t2
    out2 = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out2, 10)
    res.eq(t2.state, TaskState.BLOCKED, "T2 blocked")

    xEventGroupSetBits(eg, 0x01)
    res.eq(t1.state, TaskState.RUNNING, "T1 (highest pri) woken")
    # T2 should also be woken in the same call (loop through all waiters)
    # Actually in our sim, _wake_waiter does unconditional switch to woken task.
    # The loop continues with nxt = walker.event_group_next BEFORE wake.
    # After waking T1, T2 should also be woken.
    res.eq(t2.state, TaskState.RUNNING, "T2 also woken by same set")


def test_eg_50_delete_frees_memory_model(res):
    """Test 50: Delete then re-create works"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0F
    res.eq(eg['uxEventBits'], 0x0F, "Initial EG has bits")

    vEventGroupDelete(eg)
    # Re-create
    eg2 = xEventGroupCreate()
    res.check(eg2 is not None, "Re-created EG is valid")
    res.eq(eg2['uxEventBits'], 0, "New EG starts with 0 bits")


def test_eg_51_set_bits_no_waiters_no_switch(res):
    """Test 51: Set bits with no waiters doesn't trigger switch"""
    _reset()
    eg = xEventGroupCreate()
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T41", 10, 256, None, None)
    pxCurrentTCB.state = TaskState.RUNNING

    prev = xEventGroupSetBits(eg, 0x01)
    res.eq(prev, 0, "Previous = 0")
    res.eq(pxCurrentTCB.state, TaskState.RUNNING, "Current task still running (no waiter)")


def test_eg_52_clear_bits_no_side_effects(res):
    """Test 52: Clear bits doesn't wake anyone or change waiters"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x0F
    task = xTaskCreate("T42", 10, 256, None, None)
    task.state = TaskState.READY
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    xEventGroupWaitBits(eg, 0x01, EVENT_DO_NOT_CLEAR, out, 10)
    res.eq(task.state, TaskState.BLOCKED, "Task blocked")

    # Clear bits — should NOT wake the waiter
    prev = xEventGroupClearBits(eg, 0x01)
    res.eq(prev, 0x0F, "Previous = 0x0F")
    res.eq(eg['uxEventBits'], 0x0E, "Bit 0 cleared")
    res.eq(task.state, TaskState.BLOCKED, "Task still blocked (clear doesn't wake)")


def test_eg_53_sync_blocks_then_set_wakes(res):
    """Test 53: Sync blocks, then external set wakes"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T43", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xEventGroupSync(eg, 0x00, 0x01, EVENT_DO_NOT_CLEAR, 10)
    res.eq(ret, 0, "Sync returns pdFAIL (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "Task blocked in sync")

    # External set wakes
    xEventGroupSetBits(eg, 0x01)
    res.eq(task.state, TaskState.RUNNING, "Task woken by external set")
    res.eq(eg['uxEventBits'], 0x01, "Bits = 0x01")


def test_eg_54_multiple_sync_calls(res):
    """Test 54: Multiple sync calls in sequence"""
    _reset()
    eg = xEventGroupCreate()
    eg['uxEventBits'] = 0x00
    task = xTaskCreate("T44", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret1 = xEventGroupSync(eg, 0x01, 0x01, EVENT_CLEAR_ON_EXIT, 0)
    res.eq(ret1, 1, "Sync 1 returns pdPASS")
    res.eq(eg['uxEventBits'], 0, "Cleared after sync 1")

    ret2 = xEventGroupSync(eg, 0x02, 0x02, EVENT_CLEAR_ON_EXIT, 0)
    res.eq(ret2, 1, "Sync 2 returns pdPASS")
    res.eq(eg['uxEventBits'], 0, "Cleared after sync 2")

    ret3 = xEventGroupSync(eg, 0x04, 0x04, EVENT_DO_NOT_CLEAR, 0)
    res.eq(ret3, 1, "Sync 3 returns pdPASS")
    res.eq(eg['uxEventBits'], 0x04, "Bits = 0x04 (not cleared)")


def test_eg_55_event_group_unused_bits(res):
    """Test 55: Unused upper bits don't interfere with operations"""
    _reset()
    eg = xEventGroupCreate()
    global pxCurrentTCB; pxCurrentTCB = xTaskCreate("T45", 10, 256, None, None)

    # Set upper bits (bits 20-31)
    xEventGroupSetBits(eg, 0xFF000000)
    res.eq(eg['uxEventBits'], 0xFF000000, "Upper bits set")

    # Clear lower bits (should not affect upper)
    xEventGroupClearBits(eg, 0x000000FF)
    res.eq(eg['uxEventBits'], 0xFF000000, "Upper bits intact after clearing lower")

    # Wait for lower bits (not set) → timeout
    out = [0]
    task = pxCurrentTCB
    ret = xEventGroupWaitBits(eg, 0x00000001, EVENT_DO_NOT_CLEAR, out, 0)
    res.eq(ret, 0, "Wait for lower bit → pdFAIL")
    res.eq(eg['uxEventBits'], 0xFF000000, "Upper bits unchanged")


# ---------------------------------------------------------------------------
# Run all
# ---------------------------------------------------------------------------

def run_all_tests() -> int:
    print()
    print("══════════════════════════════════════════════════════════════")
    print("  Cortex-M RTOS — Event Group Host-Side Simulation")
    print("  (Python — mirrors C event_group.c exactly)")
    print("══════════════════════════════════════════════════════════════")
    print()

    res = TestResult()

    tests = [
        (test_eg_01_create,               "xEventGroupCreate — basic"),
        (test_eg_02_set_bits_basic,       "xEventGroupSetBits — basic"),
        (test_eg_03_set_bits_or,          "xEventGroupSetBits — OR semantics"),
        (test_eg_04_set_bits_preserves,   "xEventGroupSetBits — preserves existing"),
        (test_eg_05_set_bits_null,        "xEventGroupSetBits — NULL"),
        (test_eg_06_clear_bits_basic,     "xEventGroupClearBits — basic"),
        (test_eg_07_clear_bits_not_set,   "xEventGroupClearBits — unset bits"),
        (test_eg_08_clear_bits_returns_prev, "xEventGroupClearBits — returns prev"),
        (test_eg_09_clear_bits_null,      "xEventGroupClearBits — NULL"),
        (test_eg_10_wait_bits_immediate,  "xEventGroupWaitBits — immediate"),
        (test_eg_11_wait_bits_clear_on_exit, "xEventGroupWaitBits — clear on exit"),
        (test_eg_12_wait_bits_timeout,    "xEventGroupWaitBits — timeout"),
        (test_eg_13_wait_bits_or_any,     "xEventGroupWaitBits — OR any match"),
        (test_eg_14_wait_bits_and_all,    "xEventGroupWaitBits — AND all required"),
        (test_eg_15_wait_bits_and_met,    "xEventGroupWaitBits — AND satisfied"),
        (test_eg_16_wait_bits_block_wake, "xEventGroupWaitBits — block + set wake"),
        (test_eg_17_wait_bits_clear_on_exit_after_wake, "WaitBits clear-on-exit after wake"),
        (test_eg_18_set_bits_wakes_waiter,"xEventGroupSetBits — wakes waiter"),
        (test_eg_19_set_bits_does_not_wake_non_matching, "SetBits doesn't wake non-matching"),
        (test_eg_20_set_bits_from_isr_basic, "xEventGroupSetBitsFromISR — basic"),
        (test_eg_21_set_bits_from_isr_wake, "xEventGroupSetBitsFromISR — wakes + hpw"),
        (test_eg_22_set_bits_from_isr_null, "xEventGroupSetBitsFromISR — NULL"),
        (test_eg_23_clear_bits_from_isr_basic, "xEventGroupClearBitsFromISR — basic"),
        (test_eg_24_clear_bits_from_isr_null, "xEventGroupClearBitsFromISR — NULL"),
        (test_eg_25_delete_wakes_waiters, "vEventGroupDelete — wakes all waiters"),
        (test_eg_26_delete_null,          "vEventGroupDelete — NULL safe"),
        (test_eg_27_sync_basic,           "xEventGroupSync — basic"),
        (test_eg_28_sync_clear_on_exit,   "xEventGroupSync — clear on exit"),
        (test_eg_29_sync_timeout,         "xEventGroupSync — timeout"),
        (test_eg_30_sync_and,             "xEventGroupSync — AND semantics"),
        (test_eg_31_sync_and_met,         "xEventGroupSync — AND satisfied"),
        (test_eg_32_sync_or,              "xEventGroupSync — OR semantics"),
        (test_eg_33_sync_null,            "xEventGroupSync — NULL"),
        (test_eg_34_wait_bits_null,       "xEventGroupWaitBits — NULL"),
        (test_eg_35_wait_bits_no_current_task, "WaitBits — no current task"),
        (test_eg_36_multiple_waiters_same_bits, "Multiple waiters, same bits"),
        (test_eg_37_set_bits_after_wake_preserves_bits, "Set after wake doesn't retroactively wake"),
        (test_eg_38_wait_bits_output_unchanged_on_fail, "WaitBits output on fail"),
        (test_eg_39_event_group_independent_of_tasks, "EG independent of task lifecycle"),
        (test_eg_40_clear_bits_then_set,  "Clear then set"),
        (test_eg_41_set_bits_returns_full_prev, "SetBits returns full 32-bit prev"),
        (test_eg_42_clear_bits_returns_full_prev, "ClearBits returns full 32-bit prev"),
        (test_eg_43_wait_bits_partial_clear, "WaitBits partial clear on exit"),
        (test_eg_44_set_bits_from_isr_preserves_prev, "ISR SetBits preserves prev"),
        (test_eg_45_sync_sets_before_wait, "Sync sets before wait check"),
        (test_eg_46_sync_with_clear_then_set, "Sync clear + re-set"),
        (test_eg_47_wait_bits_with_zero_wait_for_all, "WaitBits AND with 0 bits → success"),
        (test_eg_48_wait_bits_zero_or,    "WaitBits OR with 0 bits → fail"),
        (test_eg_49_set_bits_wakes_all_matching_waiters, "SetBits wakes all matching"),
        (test_eg_50_delete_frees_memory_model, "Delete + re-create"),
        (test_eg_51_set_bits_no_waiters_no_switch, "SetBits no waiters → no switch"),
        (test_eg_52_clear_bits_no_side_effects, "ClearBits no wake side-effect"),
        (test_eg_53_sync_blocks_then_set_wakes, "Sync block + external set wake"),
        (test_eg_54_multiple_sync_calls,  "Multiple sync calls"),
        (test_eg_55_event_group_unused_bits, "Unused upper bits don't interfere"),
    ]

    for fn, desc in tests:
        print("─" * 64)
        print(f"  {desc}")
        fn(res)

    res.report()
    return res.failed


if __name__ == "__main__":
    failures = run_all_tests()
    sys.exit(0 if failures == 0 else 1)
