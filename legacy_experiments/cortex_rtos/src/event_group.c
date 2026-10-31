/**
 * event_group.c — Event Group implementation (Cortex-M RTOS)
 *
 * Host-side simulation mirror.  Corresponds 1:1 to the Python test suite
 * in tests/test_event_group.py.
 *
 * Target: ARM Cortex-M3/M4/M7  (compiled with arm-none-eabi-gcc in firmware)
 * Host:  Same logic exercised by Python simulation.
 */

#include "event_group.h"
#include "scheduler.h"
#include <string.h>

/* ==========================================================================
 * Internal helpers
 * ========================================================================== */

/** Insert a task into the event group's wait list (priority-ordered). */
static void prvAddWaiter(event_group_t *pxEventGroup, TCB_t *pxTCB)
{
    TCB_t **ppTail;

    if (pxEventGroup->xWaitList == NULL) {
        pxEventGroup->xWaitList = pxTCB;
        pxTCB->event_group_next = NULL;
        return;
    }

    /* Priority-ordered: lower number = higher priority, insert at head if
       this task has higher priority than the current head. */
    if (pxTCB->priority < pxEventGroup->xWaitList->priority) {
        pxTCB->event_group_next = pxEventGroup->xWaitList;
        pxEventGroup->xWaitList = pxTCB;
        return;
    }

    /* Walk the list to find the insertion point */
    TCB_t *pxWalker = pxEventGroup->xWaitList;
    while (pxWalker->event_group_next != NULL &&
           pxWalker->event_group_next->priority <= pxTCB->priority) {
        pxWalker = pxWalker->event_group_next;
    }
    pxTCB->event_group_next = pxWalker->event_group_next;
    pxWalker->event_group_next = pxTCB;
}

/** Remove a task from the event group's wait list. */
static void prvRemoveWaiter(event_group_t *pxEventGroup, TCB_t *pxTCB)
{
    TCB_t *pxWalker;

    if (pxEventGroup->xWaitList == NULL) {
        return;
    }

    if (pxEventGroup->xWaitList == pxTCB) {
        pxEventGroup->xWaitList = pxTCB->event_group_next;
        pxTCB->event_group_next = NULL;
        return;
    }

    pxWalker = pxEventGroup->xWaitList;
    while (pxWalker->event_group_next != NULL &&
           pxWalker->event_group_next != pxTCB) {
        pxWalker = pxWalker->event_group_next;
    }
    if (pxWalker->event_group_next == pxTCB) {
        pxWalker->event_group_next = pxTCB->event_group_next;
        pxTCB->event_group_next = NULL;
    }
}

/** Wake a task waiting on the event group (make ready, trigger switch). */
static void prvWakeWaiter(event_group_t *pxEventGroup, TCB_t *pxTCB)
{
    prvRemoveWaiter(pxEventGroup, pxTCB);
    pxTCB->state = TaskState READY;
    pxTCB->lock_type = LOCK_NONE;
    pxTCB->lock_arg = NULL;
    pxTCB->wake_tick = 0;

    vTaskAddToReadyList(pxTCB);

    /* Unconditional switch to woken task (highest priority waiter) */
    if (pxTCB->priority < xTaskGetCurrentTask()->priority) {
        vTaskSwitchContext(pxTCB);
    }
}

/* ==========================================================================
 * xEventGroupCreate
 * ========================================================================== */

event_group_t *xEventGroupCreate(void)
{
    event_group_t *pxEventGroup;

    pxEventGroup = (event_group_t *)pvPortMalloc(sizeof(event_group_t));
    if (pxEventGroup == NULL) {
        return NULL;
    }

    memset(pxEventGroup, 0, sizeof(event_group_t));
    pxEventGroup->uxEventBits = 0;
    pxEventGroup->xWaitList = NULL;

    return pxEventGroup;
}

/* ==========================================================================
 * vEventGroupDelete
 * ========================================================================== */

void vEventGroupDelete(event_group_t *pxEventGroup)
{
    TCB_t *pxWaiter;

    if (pxEventGroup == NULL) {
        return;
    }

    /* Wake all waiters */
    while ((pxWaiter = pxEventGroup->xWaitList) != NULL) {
        pxEventGroup->xWaitList = pxWaiter->event_group_next;
        pxWaiter->event_group_next = NULL;
        pxWaiter->state = TaskState READY;
        pxWaiter->lock_type = LOCK_NONE;
        pxWaiter->lock_arg = NULL;
        pxWaiter->wake_tick = 0;
        vTaskAddToReadyList(pxWaiter);
    }

    vPortFree(pxEventGroup);
}

/* ==========================================================================
 * xEventGroupSetBits
 * ========================================================================== */

EventBits_t xEventGroupSetBits(event_group_t *pxEventGroup,
                                EventBits_t uxBitsToSet)
{
    EventBits_t uxPrevious;
    TCB_t *pxWaiter;

    if (pxEventGroup == NULL) {
        return 0;
    }

    uxPrevious = pxEventGroup->uxEventBits;
    pxEventGroup->uxEventBits |= uxBitsToSet;

    /* Check all waiters — wake those whose conditions are now met */
    pxWaiter = pxEventGroup->xWaitList;
    while (pxWaiter != NULL) {
        TCB_t *pxNext = pxWaiter->event_group_next;  /* save before potential wake */

        EventBits_t uxBitsWaiting = (EventBits_t)(uintptr_t)pxWaiter->lock_arg;
        UBaseType_t xFlags = (UBaseType_t)pxWaiter->lock_extra;

        bool xNotify = false;

        if ((xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0) {
            /* AND: all requested bits must be set */
            if ((pxWaiter->lock_arg != NULL) &&
                ((pxEventGroup->uxEventBits & uxBitsWaiting) == uxBitsWaiting)) {
                xNotify = true;
            }
        } else {
            /* OR: at least one requested bit must be set */
            if ((pxEventGroup->uxEventBits & uxBitsWaiting) != 0) {
                xNotify = true;
            }
        }

        if (xNotify) {
            prvWakeWaiter(pxEventGroup, pxWaiter);
        }

        pxWaiter = pxNext;
    }

    return uxPrevious;
}

/* ==========================================================================
 * xEventGroupSetBitsFromISR
 * ========================================================================== */

EventBits_t xEventGroupSetBitsFromISR(event_group_t *pxEventGroup,
                                       EventBits_t uxBitsToSet,
                                       BaseType_t *pxHigherPriorityTaskWoken)
{
    EventBits_t uxPrevious;

    if (pxEventGroup == NULL) {
        return 0;
    }

    uxPrevious = pxEventGroup->uxEventBits;
    pxEventGroup->uxEventBits |= uxBitsToSet;

    /* Check waiters */
    TCB_t *pxWaiter = pxEventGroup->xWaitList;
    while (pxWaiter != NULL) {
        TCB_t *pxNext = pxWaiter->event_group_next;

        EventBits_t uxBitsWaiting = (EventBits_t)(uintptr_t)pxWaiter->lock_arg;
        UBaseType_t xFlags = (UBaseType_t)pxWaiter->lock_extra;

        bool xNotify = false;

        if ((xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0) {
            if ((pxEventGroup->uxEventBits & uxBitsWaiting) == uxBitsWaiting) {
                xNotify = true;
            }
        } else {
            if ((pxEventGroup->uxEventBits & uxBitsWaiting) != 0) {
                xNotify = true;
            }
        }

        if (xNotify) {
            prvWakeWaiter(pxEventGroup, pxWaiter);
            if (pxHigherPriorityTaskWoken != NULL) {
                *pxHigherPriorityTaskWoken = pdTRUE;
            }
        }

        pxWaiter = pxNext;
    }

    return uxPrevious;
}

/* ==========================================================================
 * xEventGroupClearBits
 * ========================================================================== */

EventBits_t xEventGroupClearBits(event_group_t *pxEventGroup,
                                  EventBits_t uxBitsToClear)
{
    EventBits_t uxPrevious;

    if (pxEventGroup == NULL) {
        return 0;
    }

    uxPrevious = pxEventGroup->uxEventBits;
    pxEventGroup->uxEventBits &= ~uxBitsToClear;

    return uxPrevious;
}

/* ==========================================================================
 * xEventGroupClearBitsFromISR
 * ========================================================================== */

EventBits_t xEventGroupClearBitsFromISR(event_group_t *pxEventGroup,
                                         EventBits_t uxBitsToClear)
{
    EventBits_t uxPrevious;

    if (pxEventGroup == NULL) {
        return 0;
    }

    uxPrevious = pxEventGroup->uxEventBits;
    pxEventGroup->uxEventBits &= ~uxBitsToClear;

    return uxPrevious;
}

/* ==========================================================================
 * xEventGroupWaitBits
 * ========================================================================== */

BaseType_t xEventGroupWaitBits(event_group_t *pxEventGroup,
                               EventBits_t uxBitsToWaitFor,
                               UBaseType_t xFlags,
                               EventBits_t *pxEventGroupValue,
                               TickType_t xTicksToWait)
{
    TCB_t *pxCurrent;
    EventBits_t uxCurrentBits;

    if (pxEventGroup == NULL) {
        return pdFAIL;
    }

    pxCurrent = xTaskGetCurrentTask();
    if (pxCurrent == NULL) {
        return pdFAIL;
    }

    uxCurrentBits = pxEventGroup->uxEventBits;

    /* Check if condition is already met */
    bool xConditionMet = false;

    if ((xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0) {
        /* AND: all requested bits must be set */
        if ((uxCurrentBits & uxBitsToWaitFor) == uxBitsToWaitFor) {
            xConditionMet = true;
        }
    } else {
        /* OR: at least one requested bit must be set */
        if ((uxCurrentBits & uxBitsToWaitFor) != 0) {
            xConditionMet = true;
        }
    }

    if (xConditionMet) {
        /* Return immediately */
        if (pxEventGroupValue != NULL) {
            *pxEventGroupValue = uxCurrentBits;
        }

        /* Clear bits if requested */
        if ((xFlags & EVENT_CLEAR_ON_EXIT) != 0) {
            pxEventGroup->uxEventBits &= ~uxBitsToWaitFor;
        }

        return pdPASS;
    }

    /* Non-blocking — condition not met */
    if (xTicksToWait == 0) {
        if (pxEventGroupValue != NULL) {
            *pxEventGroupValue = uxCurrentBits;
        }
        return pdFAIL;
    }

    /* Block the task */
    pxCurrent->state = TaskState BLOCKED;
    pxCurrent->lock_type = LOCK_EVENT_GROUP;
    pxCurrent->lock_arg = (void *)(uintptr_t)uxBitsToWaitFor;
    pxCurrent->lock_extra = (void *)(uintptr_t)xFlags;
    pxCurrent->wake_tick = xTaskGetTickCount() + xTicksToWait;

    prvAddWaiter(pxEventGroup, pxCurrent);

    if (xTaskGetSchedulerState() == taskSCHEDULER_RUNNING) {
        *SCB_ICSR_PENDSVSET_Msk |= SCB_ICSR_PENDSVSET_Msk;
    }

    return pdFAIL;   /* will be woken when condition is met */
}

/* ==========================================================================
 * xEventGroupSync — set + wait + optional clear (atomic)
 * ========================================================================== */

BaseType_t xEventGroupSync(event_group_t *pxEventGroup,
                           EventBits_t uxBitsToSet,
                           EventBits_t uxBitsToWaitFor,
                           UBaseType_t xFlags,
                           TickType_t xTicksToWait)
{
    EventBits_t uxPrevious;

    if (pxEventGroup == NULL) {
        return pdFAIL;
    }

    /* Step 1: set the bits */
    uxPrevious = pxEventGroup->uxEventBits;
    pxEventGroup->uxEventBits |= uxBitsToSet;

    /* Step 2: check if wait condition is met */
    bool xConditionMet = false;

    if ((xFlags & EVENT_WAIT_FOR_ALL_BITS) != 0) {
        if ((pxEventGroup->uxEventBits & uxBitsToWaitFor) == uxBitsToWaitFor) {
            xConditionMet = true;
        }
    } else {
        if ((pxEventGroup->uxEventBits & uxBitsToWaitFor) != 0) {
            xConditionMet = true;
        }
    }

    if (xConditionMet) {
        /* Clear bits if requested */
        if ((xFlags & EVENT_CLEAR_ON_EXIT) != 0) {
            pxEventGroup->uxEventBits &= ~uxBitsToWaitFor;
        }
        return pdPASS;
    }

    /* Non-blocking */
    if (xTicksToWait == 0) {
        return pdFAIL;
    }

    /* Block the current task */
    TCB_t *pxCurrent = xTaskGetCurrentTask();
    if (pxCurrent == NULL) {
        return pdFAIL;
    }

    pxCurrent->state = TaskState BLOCKED;
    pxCurrent->lock_type = LOCK_EVENT_GROUP;
    pxCurrent->lock_arg = (void *)(uintptr_t)uxBitsToWaitFor;
    pxCurrent->lock_extra = (void *)(uintptr_t)xFlags;
    pxCurrent->wake_tick = xTaskGetTickCount() + xTicksToWait;

    prvAddWaiter(pxEventGroup, pxCurrent);

    if (xTaskGetSchedulerState() == taskSCHEDULER_RUNNING) {
        *SCB_ICSR_PENDSVSET_Msk |= SCB_ICSR_PENDSVSET_Msk;
    }

    return pdFAIL;
}
