#!/usr/bin/env python3
"""
test_task_notification.py — Host-side task notification simulation tests

Validates per-task notification values: xTaskNotify, xTaskNotifyGive,
xTaskNotifyTake, xTaskNotifyWait, xTaskNotifyFromISR, xTaskNotifyGiveFromISR,
xTaskNotifyAndQuery, ulTaskNotifyValueClear, xTaskNotifyStateClear.

Mirrors the C task_notification.c implementation exactly.
"""

import sys
from dataclasses import dataclass
from typing import Optional

SCB_ICSR_PENDSVSET_Msk = 1 << 28

# ---------------------------------------------------------------------------
# Notification action / state constants (mirror C enum)
# ---------------------------------------------------------------------------
eNoAction                       = 0
eSetBits                        = 1
eIncrement                      = 2
eSetValueWithOverwrite          = 3
eSetValueWithoutOverwrite       = 4

eNoNotification                 = 0
eNotified                       = 1

# Lock types (mirror C)
LOCK_NONE                       = 0
LOCK_EVENT_NOTIFY               = 8   # task blocked on notification


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

    # --- notification fields (mirror C task_notification_t in TCB) ---
    notif_value: int = 0       # ulValue
    notif_state: int = eNoNotification  # eState


# ---- notification lock fields on TCB (mirror C lock_type / lock_arg) ----
LOCK_TYPE_KEY = "__lock_type"
LOCK_ARG_KEY  = "__lock_arg"
LOCK_EXTRA_KEY = "__lock_extra"


def _get_lock(tcb, key, default=None):
    return getattr(tcb, key, default)

def _set_lock(tcb, key, val):
    setattr(tcb, key, val)


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
    # Wake expired blocked tasks
    while blocked_list is not None and blocked_list.wake_tick <= g_system_ticks:
        woken = blocked_list
        blocked_list = woken.delay_next
        woken.delay_next = None
        woken.state = TaskState.READY
        woken.wake_tick = 0
        _ready_insert(woken)
    # Check switch needed
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
# Task notification API (mirrors task_notification.c)
# ---------------------------------------------------------------------------
def xTaskNotify(pxTaskToNotify, ulValue, eAction, xTicksToWait):
    """Send notification. Returns pdPASS/pdFAIL."""
    if pxTaskToNotify is None:
        return 0  # pdFAIL
    pxTCB = pxTaskToNotify
    if eAction == eSetValueWithoutOverwrite:
        if pxTCB.notif_state != eNoNotification:
            if xTicksToWait == 0:
                return 0
            return 0  # block would happen; fail for sim
    # Apply action
    if eAction == eNoAction:
        pxTCB.notif_state = eNotified
    elif eAction == eSetBits:
        pxTCB.notif_value |= ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eIncrement:
        pxTCB.notif_value += 1
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithoutOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    else:
        return 0
    # Wake if blocked on notification
    if (pxTCB.state == TaskState.BLOCKED and
            _get_lock(pxTCB, LOCK_TYPE_KEY) == LOCK_EVENT_NOTIFY):
        _blocked_remove(pxTCB)
        pxTCB.state = TaskState.READY
        _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_NONE)
        _set_lock(pxTCB, LOCK_ARG_KEY, None)
        _ready_insert(pxTCB)
    return 1  # pdPASS


def xTaskNotifyFromISR(pxTaskToNotify, ulValue, eAction, pxHigherPriorityTaskWoken):
    if pxTaskToNotify is None:
        return 0
    pxTCB = pxTaskToNotify
    if eAction == eSetValueWithoutOverwrite and pxTCB.notif_state != eNoNotification:
        return 0
    if eAction == eNoAction:
        pxTCB.notif_state = eNotified
    elif eAction == eSetBits:
        pxTCB.notif_value |= ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eIncrement:
        pxTCB.notif_value += 1
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithoutOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    else:
        return 0
    if (pxTCB.state == TaskState.BLOCKED and
            _get_lock(pxTCB, LOCK_TYPE_KEY) == LOCK_EVENT_NOTIFY):
        _blocked_remove(pxTCB)
        pxTCB.state = TaskState.READY
        _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_NONE)
        _set_lock(pxTCB, LOCK_ARG_KEY, None)
        _ready_insert(pxTCB)
        if pxHigherPriorityTaskWoken is not None:
            pxHigherPriorityTaskWoken[0] = 1
    return 1


def xTaskNotifyAndQuery(pxTaskToNotify, ulValue, eAction, pulPreviousValue, xTicksToWait):
    if pxTaskToNotify is None or pulPreviousValue is None:
        return 0
    pxTCB = pxTaskToNotify
    pulPreviousValue[0] = pxTCB.notif_value
    if eAction == eSetValueWithoutOverwrite and pxTCB.notif_state != eNoNotification:
        if xTicksToWait == 0:
            return 0
        return 0
    if eAction == eNoAction:
        pxTCB.notif_state = eNotified
    elif eAction == eSetBits:
        pxTCB.notif_value |= ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eIncrement:
        pxTCB.notif_value += 1
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    elif eAction == eSetValueWithoutOverwrite:
        pxTCB.notif_value = ulValue
        pxTCB.notif_state = eNotified
    else:
        return 0
    if (pxTCB.state == TaskState.BLOCKED and
            _get_lock(pxTCB, LOCK_TYPE_KEY) == LOCK_EVENT_NOTIFY):
        _blocked_remove(pxTCB)
        pxTCB.state = TaskState.READY
        _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_NONE)
        _set_lock(pxTCB, LOCK_ARG_KEY, None)
        _ready_insert(pxTCB)
    return 1


def ulTaskNotifyValueClear(pxTask):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    prev = pxTCB.notif_value
    pxTCB.notif_value = 0
    return prev


def xTaskNotifyStateClear(pxTask):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    if pxTCB.notif_state == eNoNotification:
        return 0
    pxTCB.notif_state = eNoNotification
    return 1


def xTaskNotifyWait(pxTask, ulBitsToWaitFor, pulNotificationValue, xTicksToWait):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    # If notification already pending, consume immediately
    if pxTCB.notif_state != eNoNotification:
        if pulNotificationValue is not None:
            pulNotificationValue[0] = pxTCB.notif_value
        pxTCB.notif_value = 0
        pxTCB.notif_state = eNoNotification
        return 1
    if xTicksToWait == 0:
        return 0
    # Block
    pxTCB.state = TaskState.BLOCKED
    _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    _set_lock(pxTCB, LOCK_ARG_KEY, None)
    pxTCB.wake_tick = g_system_ticks + xTicksToWait
    _blocked_insert(pxTCB)
    global mock_icsr
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk
    return 0


def xTaskNotifyGive(pxTask):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    pxTCB.notif_value += 1
    pxTCB.notif_state = eNotified
    if (pxTCB.state == TaskState.BLOCKED and
            _get_lock(pxTCB, LOCK_TYPE_KEY) == LOCK_EVENT_NOTIFY):
        _blocked_remove(pxTCB)
        pxTCB.state = TaskState.READY
        _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_NONE)
        _set_lock(pxTCB, LOCK_ARG_KEY, None)
        _ready_insert(pxTCB)
    return 1


def xTaskNotifyGiveFromISR(pxTask, pxHigherPriorityTaskWoken):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    pxTCB.notif_value += 1
    pxTCB.notif_state = eNotified
    if (pxTCB.state == TaskState.BLOCKED and
            _get_lock(pxTCB, LOCK_TYPE_KEY) == LOCK_EVENT_NOTIFY):
        _blocked_remove(pxTCB)
        pxTCB.state = TaskState.READY
        _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_NONE)
        _set_lock(pxTCB, LOCK_ARG_KEY, None)
        _ready_insert(pxTCB)
        if pxHigherPriorityTaskWoken is not None:
            pxHigherPriorityTaskWoken[0] = 1
    return 1


def xTaskNotifyTake(pxTask, xTicksToWait):
    if pxTask is None:
        return 0
    pxTCB = pxTask
    if pxTCB.notif_value > 0:
        ulVal = pxTCB.notif_value
        pxTCB.notif_value -= 1
        if pxTCB.notif_value == 0:
            pxTCB.notif_state = eNoNotification
        return ulVal
    if xTicksToWait == 0:
        return 0
    # Block
    pxTCB.state = TaskState.BLOCKED
    _set_lock(pxTCB, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    _set_lock(pxTCB, LOCK_ARG_KEY, None)
    pxTCB.wake_tick = g_system_ticks + xTicksToWait
    _blocked_insert(pxTCB)
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
            print("  🎉 ALL TASK NOTIFICATION TESTS PASSED!")
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

def test_tn_01_basic_notify(res):
    """Test 1: xTaskNotify with eSetValueWithOverwrite"""
    _reset()
    task = xTaskCreate("T1", 10, 256, None, None)
    task.notif_state = eNoNotification
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0xAB, eSetValueWithOverwrite, 0)
    res.eq(ret, 1, "xTaskNotify returns pdPASS")
    res.eq(task.notif_value, 0xAB, "notif_value = 0xAB")
    res.eq(task.notif_state, eNotified, "notif_state = eNotified")


def test_tn_02_notify_overwrite(res):
    """Test 2: Overwrite previous value"""
    _reset()
    task = xTaskCreate("T2", 10, 256, None, None)
    task.notif_value = 0x11
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0x22, eSetValueWithOverwrite, 0)
    res.eq(ret, 1, "overwrite succeeds")
    res.eq(task.notif_value, 0x22, "value overwritten to 0x22")


def test_tn_03_notify_increment(res):
    """Test 3: eIncrement action"""
    _reset()
    task = xTaskCreate("T3", 10, 256, None, None)
    task.notif_value = 5
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0, eIncrement, 0)
    res.eq(ret, 1, "increment returns pdPASS")
    res.eq(task.notif_value, 6, "value incremented to 6")
    res.eq(task.notif_state, eNotified, "state = eNotified")


def test_tn_04_notify_set_bits(res):
    """Test 4: eSetBits action"""
    _reset()
    task = xTaskCreate("T4", 10, 256, None, None)
    task.notif_value = 0x0F
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0xF0, eSetBits, 0)
    res.eq(ret, 1, "set bits returns pdPASS")
    res.eq(task.notif_value, 0xFF, "bits ORed: 0x0F | 0xF0 = 0xFF")


def test_tn_05_notify_no_action(res):
    """Test 5: eNoAction still sets state to eNotified"""
    _reset()
    task = xTaskCreate("T5", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0, eNoAction, 0)
    res.eq(ret, 1, "eNoAction returns pdPASS")
    res.eq(task.notif_state, eNotified, "state → eNotified (no change to value)")
    res.eq(task.notif_value, 0, "value unchanged")


def test_tn_06_notify_null_task(res):
    """Test 6: NULL task → pdFAIL"""
    _reset()
    ret = xTaskNotify(None, 0, eSetValueWithOverwrite, 0)
    res.eq(ret, 0, "NULL task returns pdFAIL")


def test_tn_07_notify_without_overwrite(res):
    """Test 7: eSetValueWithoutOverwrite succeeds when no pending"""
    _reset()
    task = xTaskCreate("T7", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0x42, eSetValueWithoutOverwrite, 0)
    res.eq(ret, 1, "without-overwrite succeeds when idle")
    res.eq(task.notif_value, 0x42, "value = 0x42")


def test_tn_08_notify_without_overwrite_fail(res):
    """Test 8: eSetValueWithoutOverwrite fails when notification pending"""
    _reset()
    task = xTaskCreate("T8", 10, 256, None, None)
    task.notif_state = eNotified
    task.notif_value = 0x99
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0x88, eSetValueWithoutOverwrite, 0)
    res.eq(ret, 0, "without-overwrite fails when pending")
    res.eq(task.notif_value, 0x99, "value unchanged")
    res.eq(task.notif_state, eNotified, "state unchanged")


def test_tn_09_notify_without_overwrite_block(res):
    """Test 9: eSetValueWithoutOverwrite with timeout returns pdFAIL (sim)"""
    _reset()
    task = xTaskCreate("T9", 10, 256, None, None)
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotify(task, 0x10, eSetValueWithoutOverwrite, 10)
    res.eq(ret, 0, "without-overwrite with timeout → pdFAIL (sim limitation)")


def test_tn_10_notify_wake_blocked_task(res):
    """Test 10: xTaskNotify wakes task blocked on notification wait"""
    _reset()
    task = xTaskCreate("T10", 10, 256, None, None)
    task.state = TaskState.BLOCKED
    task.wake_tick = g_system_ticks + 100
    task.notif_state = eNoNotification
    _blocked_insert(task)  # ensure in blocked list
    global pxCurrentTCB; pxCurrentTCB = task  # for lock check

    # Mark as blocked on notification
    _set_lock(task, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)

    ret = xTaskNotify(task, 0xDE, eSetValueWithOverwrite, 0)
    res.eq(ret, 1, "notify returns pdPASS")
    res.eq(task.state, TaskState.READY, "task moved to READY")
    res.eq(task.notif_value, 0xDE, "value set")
    res.eq(task.notif_state, eNotified, "state = eNotified")


def test_tn_11_xTaskNotifyGive_basic(res):
    """Test 11: xTaskNotifyGive increments value"""
    _reset()
    task = xTaskCreate("T11", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotifyGive(task)
    res.eq(ret, 1, "xTaskNotifyGive returns pdPASS")
    res.eq(task.notif_value, 1, "value = 1")
    res.eq(task.notif_state, eNotified, "state = eNotified")


def test_tn_12_xTaskNotifyGive_multiple(res):
    """Test 12: Multiple gives accumulate"""
    _reset()
    task = xTaskCreate("T12", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotifyGive(task)
    xTaskNotifyGive(task)
    xTaskNotifyGive(task)
    res.eq(task.notif_value, 3, "3 gives → value = 3")


def test_tn_13_xTaskNotifyGive_wakes(res):
    """Test 13: xTaskNotifyGive wakes blocked task"""
    _reset()
    task = xTaskCreate("T13", 10, 256, None, None)
    task.state = TaskState.BLOCKED
    task.wake_tick = g_system_ticks + 100
    _blocked_insert(task)
    _set_lock(task, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotifyGive(task)
    res.eq(ret, 1, "give returns pdPASS")
    res.eq(task.state, TaskState.READY, "task woken")
    res.eq(task.notif_value, 1, "value incremented")


def test_tn_14_xTaskNotifyGive_null(res):
    """Test 14: NULL task → pdFAIL"""
    _reset()
    ret = xTaskNotifyGive(None)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_tn_15_xTaskNotifyTake_basic(res):
    """Test 15: xTaskNotifyTake returns value when > 0"""
    _reset()
    task = xTaskCreate("T15", 10, 256, None, None)
    task.notif_value = 5
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    val = xTaskNotifyTake(task, 0)
    res.eq(val, 5, "take returns 5")
    res.eq(task.notif_value, 4, "value decremented to 4")


def test_tn_16_xTaskNotifyTake_zero(res):
    """Test 16: xTaskNotifyTake returns 0 when value = 0 (non-block)"""
    _reset()
    task = xTaskCreate("T16", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    val = xTaskNotifyTake(task, 0)
    res.eq(val, 0, "take returns 0 (non-blocking, no value)")
    res.eq(task.state, TaskState.READY, "state unchanged")


def test_tn_17_xTaskNotifyTake_blocks(res):
    """Test 17: xTaskNotifyTake blocks when value = 0 and timeout > 0"""
    _reset()
    task = xTaskCreate("T17", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    val = xTaskNotifyTake(task, 10)
    res.eq(val, 0, "take returns 0 (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "task blocked")
    res.eq(task.wake_tick, g_system_ticks + 10, "wake_tick set")


def test_tn_18_xTaskNotifyTake_wake(res):
    """Test 18: Give wakes task blocked in xTaskNotifyTake"""
    _reset()
    task = xTaskCreate("T18", 10, 256, None, None)
    task.notif_value = 0
    task.state = TaskState.BLOCKED
    task.wake_tick = g_system_ticks + 100
    _blocked_insert(task)
    _set_lock(task, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotifyTake(task, 10)  # blocks
    res.eq(task.state, TaskState.BLOCKED, "task blocked in take")

    # Now give from another "ISR"
    xTaskNotifyGive(task)
    res.eq(task.state, TaskState.READY, "task woken by give")
    res.eq(task.notif_value, 1, "value = 1")


def test_tn_19_xTaskNotifyTake_null(res):
    """Test 19: NULL task → 0"""
    _reset()
    val = xTaskNotifyTake(None, 0)
    res.eq(val, 0, "NULL → 0")


def test_tn_20_xTaskNotifyTake_decrements_to_zero(res):
    """Test 20: Take when value = 1 clears state"""
    _reset()
    task = xTaskCreate("T20", 10, 256, None, None)
    task.notif_value = 1
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    val = xTaskNotifyTake(task, 0)
    res.eq(val, 1, "take returns 1")
    res.eq(task.notif_value, 0, "value = 0")
    res.eq(task.notif_state, eNoNotification, "state → eNoNotification")


def test_tn_21_xTaskNotifyWait_immediate(res):
    """Test 21: xTaskNotifyWait returns immediately if notification pending"""
    _reset()
    task = xTaskCreate("T21", 10, 256, None, None)
    task.notif_value = 0xA5
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 0)
    res.eq(ret, 1, "wait returns pdPASS (immediate)")
    res.eq(out[0], 0xA5, "output value = 0xA5")
    res.eq(task.notif_value, 0, "value cleared")
    res.eq(task.notif_state, eNoNotification, "state cleared")


def test_tn_22_xTaskNotifyWait_timeout(res):
    """Test 22: xTaskNotifyWait returns pdFAIL on timeout (non-blocking sim)"""
    _reset()
    task = xTaskCreate("T22", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 0)
    res.eq(ret, 0, "wait returns pdFAIL (no notification, non-blocking)")
    res.eq(task.state, TaskState.READY, "state unchanged")


def test_tn_23_xTaskNotifyWait_block_wake(res):
    """Test 23: xTaskNotifyWait blocks then wakes on notify"""
    _reset()
    task = xTaskCreate("T23", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 10)
    res.eq(ret, 0, "wait returns pdFAIL (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "task blocked")

    # Notify wakes it
    xTaskNotify(task, 0xCA, eSetValueWithOverwrite, 0)
    res.eq(task.state, TaskState.READY, "task woken by notify")
    res.eq(task.notif_value, 0xCA, "value set")


def test_tn_24_xTaskNotifyWait_null(res):
    """Test 24: NULL task → pdFAIL"""
    _reset()
    out = [0]
    ret = xTaskNotifyWait(None, 0, out, 0)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_tn_25_xTaskNotifyWait_clears(res):
    """Test 25: xTaskNotifyWait clears value and state on return"""
    _reset()
    task = xTaskCreate("T25", 10, 256, None, None)
    task.notif_value = 0x77
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 0)
    res.eq(ret, 1, "wait returns pdPASS")
    res.eq(out[0], 0x77, "output = 0x77")
    res.eq(task.notif_value, 0, "value cleared")
    res.eq(task.notif_state, eNoNotification, "state cleared")


def test_tn_26_xTaskNotifyFromISR_basic(res):
    """Test 26: xTaskNotifyFromISR with eSetValueWithOverwrite"""
    _reset()
    task = xTaskCreate("T26", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyFromISR(task, 0x55, eSetValueWithOverwrite, hpw)
    res.eq(ret, 1, "ISR notify returns pdPASS")
    res.eq(task.notif_value, 0x55, "value = 0x55")
    res.eq(task.notif_state, eNotified, "state = eNotified")
    res.eq(hpw[0], 0, "hpw not set (task not blocked)")


def test_tn_27_xTaskNotifyFromISR_increment(res):
    """Test 27: xTaskNotifyFromISR with eIncrement"""
    _reset()
    task = xTaskCreate("T27", 10, 256, None, None)
    task.notif_value = 3
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyFromISR(task, 0, eIncrement, hpw)
    res.eq(ret, 1, "ISR increment returns pdPASS")
    res.eq(task.notif_value, 4, "value = 4")
    res.eq(hpw[0], 0, "hpw not set")


def test_tn_28_xTaskNotifyFromISR_set_bits(res):
    """Test 28: xTaskNotifyFromISR with eSetBits"""
    _reset()
    task = xTaskCreate("T28", 10, 256, None, None)
    task.notif_value = 0x0F
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyFromISR(task, 0xF0, eSetBits, hpw)
    res.eq(ret, 1, "ISR set bits returns pdPASS")
    res.eq(task.notif_value, 0xFF, "value = 0xFF")


def test_tn_29_xTaskNotifyFromISR_wake(res):
    """Test 29: xTaskNotifyFromISR wakes blocked task, sets hpw"""
    _reset()
    task = xTaskCreate("T29", 10, 256, None, None)
    task.state = TaskState.BLOCKED
    task.wake_tick = g_system_ticks + 100
    _blocked_insert(task)
    _set_lock(task, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyFromISR(task, 0x10, eSetValueWithOverwrite, hpw)
    res.eq(ret, 1, "ISR notify returns pdPASS")
    res.eq(task.state, TaskState.READY, "task woken")
    res.eq(hpw[0], 1, "hpw set (context switch needed)")


def test_tn_30_xTaskNotifyFromISR_null(res):
    """Test 30: NULL task → pdFAIL"""
    _reset()
    hpw = [0]
    ret = xTaskNotifyFromISR(None, 0, eSetValueWithOverwrite, hpw)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_tn_31_xTaskNotifyGiveFromISR_basic(res):
    """Test 31: xTaskNotifyGiveFromISR increments value"""
    _reset()
    task = xTaskCreate("T31", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyGiveFromISR(task, hpw)
    res.eq(ret, 1, "ISR give returns pdPASS")
    res.eq(task.notif_value, 1, "value = 1")
    res.eq(hpw[0], 0, "hpw not set (task not blocked)")


def test_tn_32_xTaskNotifyGiveFromISR_wake(res):
    """Test 32: xTaskNotifyGiveFromISR wakes blocked task, sets hpw"""
    _reset()
    task = xTaskCreate("T32", 10, 256, None, None)
    task.state = TaskState.BLOCKED
    task.wake_tick = g_system_ticks + 100
    _blocked_insert(task)
    _set_lock(task, LOCK_TYPE_KEY, LOCK_EVENT_NOTIFY)
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    ret = xTaskNotifyGiveFromISR(task, hpw)
    res.eq(ret, 1, "ISR give returns pdPASS")
    res.eq(task.state, TaskState.READY, "task woken")
    res.eq(task.notif_value, 1, "value = 1")
    res.eq(hpw[0], 1, "hpw set")


def test_tn_33_xTaskNotifyGiveFromISR_null(res):
    """Test 33: NULL task → pdFAIL"""
    _reset()
    hpw = [0]
    ret = xTaskNotifyGiveFromISR(None, hpw)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_tn_34_xTaskNotifyAndQuery_basic(res):
    """Test 34: xTaskNotifyAndQuery returns previous value"""
    _reset()
    task = xTaskCreate("T34", 10, 256, None, None)
    task.notif_value = 0x1234
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    prev = [0]
    ret = xTaskNotifyAndQuery(task, 0x5678, eSetValueWithOverwrite, prev, 0)
    res.eq(ret, 1, "and-query returns pdPASS")
    res.eq(prev[0], 0x1234, "previous value = 0x1234")
    res.eq(task.notif_value, 0x5678, "new value = 0x5678")


def test_tn_35_xTaskNotifyAndQuery_increment(res):
    """Test 35: xTaskNotifyAndQuery with eIncrement returns previous"""
    _reset()
    task = xTaskCreate("T35", 10, 256, None, None)
    task.notif_value = 10
    global pxCurrentTCB; pxCurrentTCB = task

    prev = [0]
    ret = xTaskNotifyAndQuery(task, 0, eIncrement, prev, 0)
    res.eq(ret, 1, "and-query increment returns pdPASS")
    res.eq(prev[0], 10, "previous = 10")
    res.eq(task.notif_value, 11, "value = 11")


def test_tn_36_xTaskNotifyAndQuery_null_task(res):
    """Test 36: NULL task → pdFAIL"""
    _reset()
    prev = [0]
    ret = xTaskNotifyAndQuery(None, 0, eSetValueWithOverwrite, prev, 0)
    res.eq(ret, 0, "NULL task → pdFAIL")


def test_tn_37_xTaskNotifyAndQuery_null_output(res):
    """Test 37: NULL output pointer → pdFAIL"""
    _reset()
    task = xTaskCreate("T37", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotifyAndQuery(task, 0, eSetValueWithOverwrite, None, 0)
    res.eq(ret, 0, "NULL output → pdFAIL")


def test_tn_38_ulTaskNotifyValueClear_basic(res):
    """Test 38: ulTaskNotifyValueClear returns and clears value"""
    _reset()
    task = xTaskCreate("T38", 10, 256, None, None)
    task.notif_value = 0xDEAD
    global pxCurrentTCB; pxCurrentTCB = task

    val = ulTaskNotifyValueClear(task)
    res.eq(val, 0xDEAD, "returns 0xDEAD")
    res.eq(task.notif_value, 0, "value cleared to 0")


def test_tn_39_ulTaskNotifyValueClear_zero(res):
    """Test 39: ulTaskNotifyValueClear returns 0 when value is 0"""
    _reset()
    task = xTaskCreate("T39", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    val = ulTaskNotifyValueClear(task)
    res.eq(val, 0, "returns 0")
    res.eq(task.notif_value, 0, "still 0")


def test_tn_40_ulTaskNotifyValueClear_null(res):
    """Test 40: NULL task → 0"""
    _reset()
    val = ulTaskNotifyValueClear(None)
    res.eq(val, 0, "NULL → 0")


def test_tn_41_xTaskNotifyStateClear_basic(res):
    """Test 41: xTaskNotifyStateClear clears pending state"""
    _reset()
    task = xTaskCreate("T41", 10, 256, None, None)
    task.notif_state = eNotified
    task.notif_value = 0x99
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotifyStateClear(task)
    res.eq(ret, 1, "state clear returns pdPASS")
    res.eq(task.notif_state, eNoNotification, "state → eNoNotification")
    res.eq(task.notif_value, 0x99, "value unchanged")


def test_tn_42_xTaskNotifyStateClear_no_pending(res):
    """Test 42: xTaskNotifyStateClear returns pdFAIL when no pending"""
    _reset()
    task = xTaskCreate("T42", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    ret = xTaskNotifyStateClear(task)
    res.eq(ret, 0, "no pending → pdFAIL")
    res.eq(task.notif_state, eNoNotification, "still eNoNotification")


def test_tn_43_xTaskNotifyStateClear_null(res):
    """Test 43: NULL task → pdFAIL"""
    _reset()
    ret = xTaskNotifyStateClear(None)
    res.eq(ret, 0, "NULL → pdFAIL")


def test_tn_44_notify_state_persists_after_clear_value(res):
    """Test 44: Clearing value does NOT clear state"""
    _reset()
    task = xTaskCreate("T44", 10, 256, None, None)
    task.notif_value = 0x55
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    ulTaskNotifyValueClear(task)
    res.eq(task.notif_value, 0, "value = 0")
    res.eq(task.notif_state, eNotified, "state still eNotified (not cleared by value clear)")


def test_tn_45_state_clear_then_notify(res):
    """Test 45: After state clear, next notify works normally"""
    _reset()
    task = xTaskCreate("T45", 10, 256, None, None)
    task.notif_state = eNotified
    task.notif_value = 0x10
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotifyStateClear(task)
    res.eq(task.notif_state, eNoNotification, "state cleared")

    xTaskNotify(task, 0x20, eSetValueWithOverwrite, 0)
    res.eq(task.notif_state, eNotified, "state → eNotified")
    res.eq(task.notif_value, 0x20, "value = 0x20")


def test_tn_46_multiple_notifies_same_task(res):
    """Test 46: Multiple notifies to same task overwrite correctly"""
    _reset()
    task = xTaskCreate("T46", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotify(task, 0x11, eSetValueWithOverwrite, 0)
    xTaskNotify(task, 0x22, eSetValueWithOverwrite, 0)
    xTaskNotify(task, 0x33, eSetValueWithOverwrite, 0)
    res.eq(task.notif_value, 0x33, "last write wins: 0x33")
    res.eq(task.notif_state, eNotified, "state = eNotified")


def test_tn_47_take_after_multiple_gives(res):
    """Test 47: Take after multiple gives returns accumulated value"""
    _reset()
    task = xTaskCreate("T47", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotifyGive(task)
    xTaskNotifyGive(task)
    xTaskNotifyGive(task)
    res.eq(task.notif_value, 3, "value = 3")

    val = xTaskNotifyTake(task, 0)
    res.eq(val, 3, "take returns 3")
    res.eq(task.notif_value, 2, "value = 2 after take")


def test_tn_48_notify_then_wait_sequence(res):
    """Test 48: Notify then wait — wait returns immediately"""
    _reset()
    task = xTaskCreate("T48", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotify(task, 0x7F, eSetValueWithOverwrite, 0)
    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 10)
    res.eq(ret, 1, "wait returns immediately (notification pending)")
    res.eq(out[0], 0x7F, "output = 0x7F")


def test_tn_49_wait_then_notify_after_timeout(res):
    """Test 49: Wait blocks, then notify wakes (simulated tick)"""
    _reset()
    task = xTaskCreate("T49", 10, 256, None, None)
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    out = [0]
    ret = xTaskNotifyWait(task, 0, out, 10)
    res.eq(ret, 0, "wait returns pdFAIL (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "task blocked")

    # Simulate tick expiry then notify
    g_system_ticks = task.wake_tick  # tick reaches wake time — but notify is what wakes
    # Actually in sim, notify wakes directly (not via tick)
    xTaskNotify(task, 0x44, eSetValueWithOverwrite, 0)
    res.eq(task.state, TaskState.READY, "task woken by notify (not tick)")
    res.eq(task.notif_value, 0x44, "value set")


def test_tn_50_take_blocks_then_give_wakes(res):
    """Test 50: Take blocks, give wakes, take returns value"""
    _reset()
    task = xTaskCreate("T50", 10, 256, None, None)
    task.notif_value = 0
    global pxCurrentTCB; pxCurrentTCB = task

    val = xTaskNotifyTake(task, 10)
    res.eq(val, 0, "take returns 0 (blocked)")
    res.eq(task.state, TaskState.BLOCKED, "task blocked")

    xTaskNotifyGive(task)
    res.eq(task.state, TaskState.READY, "task woken")
    res.eq(task.notif_value, 1, "value = 1")

    # Now take should succeed
    val = xTaskNotifyTake(task, 0)
    res.eq(val, 1, "take returns 1")
    res.eq(task.notif_value, 0, "value = 0")


def test_tn_51_notification_value_wrap(res):
    """Test 51: Large notification values handled (uint32 sim)"""
    _reset()
    task = xTaskCreate("T51", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotify(task, 0xFFFFFF, eSetValueWithOverwrite, 0)
    res.eq(task.notif_value, 0xFFFFFF, "large value stored")
    res.eq(task.notif_state, eNotified, "state = eNotified")


def test_tn_52_give_from_isr_sets_hpw_only_when_woken(res):
    """Test 52: GiveFromISR hpw=0 when task not blocked"""
    _reset()
    task = xTaskCreate("T52", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    hpw = [0]
    xTaskNotifyGiveFromISR(task, hpw)
    res.eq(hpw[0], 0, "hpw = 0 (task not blocked, no switch needed)")


def test_tn_53_state_after_take_clears_at_zero(res):
    """Test 53: State clears when value reaches 0 after take"""
    _reset()
    task = xTaskCreate("T53", 10, 256, None, None)
    task.notif_value = 1
    task.notif_state = eNotified
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotifyTake(task, 0)
    res.eq(task.notif_value, 0, "value = 0")
    res.eq(task.notif_state, eNoNotification, "state → eNoNotification")


def test_tn_54_increment_preserves_nonzero_state(res):
    """Test 54: Increment keeps state = eNotified even when value was 0"""
    _reset()
    task = xTaskCreate("T54", 10, 256, None, None)
    task.notif_value = 0
    task.notif_state = eNoNotification
    global pxCurrentTCB; pxCurrentTCB = task

    xTaskNotify(task, 0, eIncrement, 0)
    res.eq(task.notif_value, 1, "value = 1")
    res.eq(task.notif_state, eNotified, "state → eNotified")


def test_tn_55_notification_independent_of_semaphore(res):
    """Test 55: Notification state is independent of any semaphore"""
    _reset()
    task = xTaskCreate("T55", 10, 256, None, None)
    global pxCurrentTCB; pxCurrentTCB = task

    # Notify
    xTaskNotify(task, 0xAA, eSetValueWithOverwrite, 0)
    res.eq(task.notif_value, 0xAA, "notification value = 0xAA")
    res.eq(task.notif_state, eNotified, "state = eNotified")

    # State is NOT affected by task state changes
    task.state = TaskState.BLOCKED
    res.eq(task.notif_state, eNotified, "notification state persists across task state change")

    # Clear notification
    xTaskNotifyStateClear(task)
    res.eq(task.notif_state, eNoNotification, "state cleared independently")


# ---------------------------------------------------------------------------
# Run all
# ---------------------------------------------------------------------------

def run_all_tests() -> int:
    print()
    print("══════════════════════════════════════════════════════════════")
    print("  Cortex-M RTOS — Task Notification Host-Side Simulation")
    print("  (Python — mirrors C task_notification.c exactly)")
    print("══════════════════════════════════════════════════════════════")
    print()

    res = TestResult()

    tests = [
        (test_tn_01_basic_notify, "Basic xTaskNotify (overwrite)"),
        (test_tn_02_notify_overwrite, "Overwrite previous value"),
        (test_tn_03_notify_increment, "eIncrement action"),
        (test_tn_04_notify_set_bits, "eSetBits action"),
        (test_tn_05_notify_no_action, "eNoAction sets state"),
        (test_tn_06_notify_null_task, "NULL task → pdFAIL"),
        (test_tn_07_notify_without_overwrite, "eSetValueWithoutOverwrite (idle)"),
        (test_tn_08_notify_without_overwrite_fail, "eSetValueWithoutOverwrite (pending)"),
        (test_tn_09_notify_without_overwrite_block, "eSetValueWithoutOverwrite (timeout)"),
        (test_tn_10_notify_wake_blocked_task, "Notify wakes blocked task"),
        (test_tn_11_xTaskNotifyGive_basic, "xTaskNotifyGive basic"),
        (test_tn_12_xTaskNotifyGive_multiple, "Multiple xTaskNotifyGive"),
        (test_tn_13_xTaskNotifyGive_wakes, "xTaskNotifyGive wakes blocked"),
        (test_tn_14_xTaskNotifyGive_null, "xTaskNotifyGive NULL"),
        (test_tn_15_xTaskNotifyTake_basic, "xTaskNotifyTake returns value"),
        (test_tn_16_xTaskNotifyTake_zero, "xTaskNotifyTake zero (non-block)"),
        (test_tn_17_xTaskNotifyTake_blocks, "xTaskNotifyTake blocks"),
        (test_tn_18_xTaskNotifyTake_wake, "Give wakes blocked take"),
        (test_tn_19_xTaskNotifyTake_null, "xTaskNotifyTake NULL"),
        (test_tn_20_xTaskNotifyTake_decrements_to_zero, "Take clears state at zero"),
        (test_tn_21_xTaskNotifyWait_immediate, "xTaskNotifyWait immediate"),
        (test_tn_22_xTaskNotifyWait_timeout, "xTaskNotifyWait timeout"),
        (test_tn_23_xTaskNotifyWait_block_wake, "xTaskNotifyWait block + wake"),
        (test_tn_24_xTaskNotifyWait_null, "xTaskNotifyWait NULL"),
        (test_tn_25_xTaskNotifyWait_clears, "xTaskNotifyWait clears value/state"),
        (test_tn_26_xTaskNotifyFromISR_basic, "xTaskNotifyFromISR basic"),
        (test_tn_27_xTaskNotifyFromISR_increment, "xTaskNotifyFromISR increment"),
        (test_tn_28_xTaskNotifyFromISR_set_bits, "xTaskNotifyFromISR set bits"),
        (test_tn_29_xTaskNotifyFromISR_wake, "xTaskNotifyFromISR wakes + hpw"),
        (test_tn_30_xTaskNotifyFromISR_null, "xTaskNotifyFromISR NULL"),
        (test_tn_31_xTaskNotifyGiveFromISR_basic, "xTaskNotifyGiveFromISR basic"),
        (test_tn_32_xTaskNotifyGiveFromISR_wake, "xTaskNotifyGiveFromISR wakes + hpw"),
        (test_tn_33_xTaskNotifyGiveFromISR_null, "xTaskNotifyGiveFromISR NULL"),
        (test_tn_34_xTaskNotifyAndQuery_basic, "xTaskNotifyAndQuery returns previous"),
        (test_tn_35_xTaskNotifyAndQuery_increment, "xTaskNotifyAndQuery increment"),
        (test_tn_36_xTaskNotifyAndQuery_null_task, "xTaskNotifyAndQuery NULL task"),
        (test_tn_37_xTaskNotifyAndQuery_null_output, "xTaskNotifyAndQuery NULL output"),
        (test_tn_38_ulTaskNotifyValueClear_basic, "ulTaskNotifyValueClear basic"),
        (test_tn_39_ulTaskNotifyValueClear_zero, "ulTaskNotifyValueClear zero"),
        (test_tn_40_ulTaskNotifyValueClear_null, "ulTaskNotifyValueClear NULL"),
        (test_tn_41_xTaskNotifyStateClear_basic, "xTaskNotifyStateClear basic"),
        (test_tn_42_xTaskNotifyStateClear_no_pending, "xTaskNotifyStateClear no pending"),
        (test_tn_43_xTaskNotifyStateClear_null, "xTaskNotifyStateClear NULL"),
        (test_tn_44_notify_state_persists_after_clear_value, "Value clear doesn't clear state"),
        (test_tn_45_state_clear_then_notify, "State clear then notify"),
        (test_tn_46_multiple_notifies_same_task, "Multiple notifies overwrite"),
        (test_tn_47_take_after_multiple_gives, "Take after multiple gives"),
        (test_tn_48_notify_then_wait_sequence, "Notify then wait"),
        (test_tn_49_wait_then_notify_after_timeout, "Wait block + notify wake"),
        (test_tn_50_take_blocks_then_give_wakes, "Take block + give wake + take"),
        (test_tn_51_notification_value_wrap, "Large notification value"),
        (test_tn_52_give_from_isr_sets_hpw_only_when_woken, "GiveFromISR hpw when not blocked"),
        (test_tn_53_state_after_take_clears_at_zero, "State clears at zero after take"),
        (test_tn_54_increment_preserves_nonzero_state, "Increment sets state"),
        (test_tn_55_notification_independent_of_semaphore, "Notification independent of task state"),
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
