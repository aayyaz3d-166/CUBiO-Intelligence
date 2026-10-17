/**
 * task_notification.c — Task Notification implementation (Cortex-M RTOS)
 *
 * Host-side simulation mirror.  Corresponds 1:1 to the Python test suite
 * in tests/test_task_notification.py.
 *
 * Target: ARM Cortex-M3/M4/M7  (compiled with arm-none-eabi-gcc in firmware)
 * Host:  Same logic exercised by Python simulation.
 */

#include "task_notification.h"
#include "scheduler.h"
#include <string.h>

/* ==========================================================================
 * Internal: per-TCB notification state access
 * ========================================================================== */

static inline task_notification_t *
prvGetNotification(TCB_t *pxTCB)
{
    return &pxTCB->task_notification;
}

/* ==========================================================================
 * xTaskNotify — send a notification to a task
 * ========================================================================== */

BaseType_t xTaskNotify(TaskHandle_t pxTaskToNotify,
                       TaskNotification_t ulValue,
                       UBaseType_t eAction,
                       TickType_t xTicksToWait)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTaskToNotify == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTaskToNotify;
    pxNotify = prvGetNotification(pxTCB);

    /* --- Non-blocking check for eSetValueWithoutOverwrite --- */
    if (eAction == eSetValueWithoutOverwrite) {
        if (pxNotify->eState != eNoNotification) {
            if (xTicksToWait == 0) {
                return pdFAIL;   /* no space now, don't block */
            }
            /* Would block — for simulation we just return pdFAIL */
            return pdFAIL;
        }
    }

    /* --- Apply the action --- */
    switch (eAction) {
    case eNoAction:
        /* Nothing changes; still mark as notified so a subsequent wait
           returns immediately. */
        pxNotify->eState = eNotified;
        break;

    case eSetBits:
        pxNotify->ulValue |= ulValue;
        pxNotify->eState = eNotified;
        break;

    case eIncrement:
        pxNotify->ulValue += 1;
        pxNotify->eState = eNotified;
        break;

    case eSetValueWithOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;

    case eSetValueWithoutOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;

    default:
        return pdFAIL;
    }

    /* --- If the task is blocked waiting for a notification, wake it --- */
    if (pxTCB->state == TaskState BLOCKED &&
        pxTCB->lock_type == LOCK_EVENT_NOTIFY) {
        /* Remove from blocked list and make ready */
        vTaskRemoveFromBlockedList(pxTCB);
        pxTCB->state = TaskState READY;
        pxTCB->lock_type = LOCK_NONE;
        prvInsertTCBIntoReadyList(pxTCB);
    }

    return pdPASS;
}

/* ==========================================================================
 * xTaskNotifyFromISR
 * ========================================================================== */

BaseType_t xTaskNotifyFromISR(TaskHandle_t pxTaskToNotify,
                              TaskNotification_t ulValue,
                              UBaseType_t eAction,
                              BaseType_t *pxHigherPriorityTaskWoken)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;
    BaseType_t xResult;

    if (pxTaskToNotify == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTaskToNotify;
    pxNotify = prvGetNotification(pxTCB);

    if (eAction == eSetValueWithoutOverwrite &&
        pxNotify->eState != eNoNotification) {
        if (xTicksToWait == 0) {   /* not passed here; always fail in ISR */
            return pdFAIL;
        }
    }

    switch (eAction) {
    case eNoAction:
        pxNotify->eState = eNotified;
        break;
    case eSetBits:
        pxNotify->ulValue |= ulValue;
        pxNotify->eState = eNotified;
        break;
    case eIncrement:
        pxNotify->ulValue += 1;
        pxNotify->eState = eNotified;
        break;
    case eSetValueWithOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;
    case eSetValueWithoutOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;
    default:
        return pdFAIL;
    }

    /* Wake the task if it is blocked waiting */
    if (pxTCB->state == TaskState BLOCKED &&
        pxTCB->lock_type == LOCK_EVENT_NOTIFY) {
        vTaskRemoveFromBlockedList(pxTCB);
        pxTCB->state = TaskState READY;
        pxTCB->lock_type = LOCK_NONE;
        prvInsertTCBIntoReadyList(pxTCB);

        if (pxHigherPriorityTaskWoken != NULL) {
            *pxHigherPriorityTaskWoken = pdTRUE;
        }
    }

    return pdPASS;
}

/* ==========================================================================
 * xTaskNotifyAndQuery — send notification + return previous value
 * ========================================================================== */

BaseType_t xTaskNotifyAndQuery(TaskHandle_t pxTaskToNotify,
                               TaskNotification_t ulValue,
                               UBaseType_t eAction,
                               TaskNotification_t *pulPreviousValue,
                               TickType_t xTicksToWait)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTaskToNotify == NULL || pulPreviousValue == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTaskToNotify;
    pxNotify = prvGetNotification(pxTCB);

    *pulPreviousValue = pxNotify->ulValue;

    if (eAction == eSetValueWithoutOverwrite) {
        if (pxNotify->eState != eNoNotification) {
            if (xTicksToWait == 0) {
                return pdFAIL;
            }
            return pdFAIL;
        }
    }

    /* Apply action (same logic as xTaskNotify) */
    switch (eAction) {
    case eNoAction:
        pxNotify->eState = eNotified;
        break;
    case eSetBits:
        pxNotify->ulValue |= ulValue;
        pxNotify->eState = eNotified;
        break;
    case eIncrement:
        pxNotify->ulValue += 1;
        pxNotify->eState = eNotified;
        break;
    case eSetValueWithOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;
    case eSetValueWithoutOverwrite:
        pxNotify->ulValue = ulValue;
        pxNotify->eState = eNotified;
        break;
    default:
        return pdFAIL;
    }

    if (pxTCB->state == TaskState BLOCKED &&
        pxTCB->lock_type == LOCK_EVENT_NOTIFY) {
        vTaskRemoveFromBlockedList(pxTCB);
        pxTCB->state = TaskState READY;
        pxTCB->lock_type = LOCK_NONE;
        prvInsertTCBIntoReadyList(pxTCB);
    }

    return pdPASS;
}

/* ==========================================================================
 * ulTaskNotifyValueClear — clear value and return previous
 * ========================================================================== */

TaskNotification_t ulTaskNotifyValueClear(TaskHandle_t pxTask)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;
    TaskNotification_t ulPrev;

    if (pxTask == NULL) {
        return 0;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    ulPrev = pxNotify->ulValue;
    pxNotify->ulValue = 0;

    return ulPrev;
}

/* ==========================================================================
 * xTaskNotifyStateClear — clear notification state only
 * ========================================================================== */

BaseType_t xTaskNotifyStateClear(TaskHandle_t pxTask)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTask == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    if (pxNotify->eState == eNoNotification) {
        return pdFAIL;
    }

    pxNotify->eState = eNoNotification;
    return pdPASS;
}

/* ==========================================================================
 * xTaskNotifyWait — block until a notification arrives
 * ========================================================================== */

BaseType_t xTaskNotifyWait(TaskHandle_t pxTask,
                           TaskNotification_t ulBitsToWaitFor,
                           TaskNotification_t *pulNotificationValue,
                           TickType_t xTicksToWait)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTask == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    /* If a notification is already pending, consume it immediately */
    if (pxNotify->eState != eNoNotification) {
        if (pulNotificationValue != NULL) {
            *pulNotificationValue = pxNotify->ulValue;
        }
        pxNotify->ulValue = 0;
        pxNotify->eState = eNoNotification;
        return pdPASS;
    }

    /* Non-blocking request */
    if (xTicksToWait == 0) {
        return pdFAIL;
    }

    /* Block the task */
    pxTCB->state = TaskState BLOCKED;
    pxTCB->lock_type = LOCK_EVENT_NOTIFY;
    pxTCB->lock_arg = (void *)(uintptr_t)ulBitsToWaitFor;
    pxTCB->wake_tick = xTaskGetTickCount() + xTicksToWait;

    vTaskAddToBlockedList(pxTCB);

    if (xTaskGetSchedulerState() == taskSCHEDULER_RUNNING) {
        /* PendSV will select the next task */
        *SCB_ICSR_PENDSVSET_Msk |= SCB_ICSR_PENDSVSET_Msk;
    }

    return pdFAIL;   /* will return pdPASS via the wake path */
}

/* ==========================================================================
 * xTaskNotifyGive — increment notification value (wake if waiting)
 * ========================================================================== */

BaseType_t xTaskNotifyGive(TaskHandle_t pxTask)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTask == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    pxNotify->ulValue += 1;
    pxNotify->eState = eNotified;

    if (pxTCB->state == TaskState BLOCKED &&
        pxTCB->lock_type == LOCK_EVENT_NOTIFY) {
        vTaskRemoveFromBlockedList(pxTCB);
        pxTCB->state = TaskState READY;
        pxTCB->lock_type = LOCK_NONE;
        prvInsertTCBIntoReadyList(pxTCB);
    }

    return pdPASS;
}

/* ==========================================================================
 * xTaskNotifyGiveFromISR
 * ========================================================================== */

BaseType_t xTaskNotifyGiveFromISR(TaskHandle_t pxTask,
                                  BaseType_t *pxHigherPriorityTaskWoken)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTask == NULL) {
        return pdFAIL;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    pxNotify->ulValue += 1;
    pxNotify->eState = eNotified;

    if (pxTCB->state == TaskState BLOCKED &&
        pxTCB->lock_type == LOCK_EVENT_NOTIFY) {
        vTaskRemoveFromBlockedList(pxTCB);
        pxTCB->state = TaskState READY;
        pxTCB->lock_type = LOCK_NONE;
        prvInsertTCBIntoReadyList(pxTCB);

        if (pxHigherPriorityTaskWoken != NULL) {
            *pxHigherPriorityTaskWoken = pdTRUE;
        }
    }

    return pdPASS;
}

/* ==========================================================================
 * xTaskNotifyTake — decrement / take notification value (block if zero)
 * ========================================================================== */

TaskNotification_t xTaskNotifyTake(TaskHandle_t pxTask,
                                    TickType_t xTicksToWait)
{
    TCB_t *pxTCB;
    task_notification_t *pxNotify;

    if (pxTask == NULL) {
        return 0;
    }

    pxTCB = pxTask;
    pxNotify = prvGetNotification(pxTCB);

    /* If value > 0, decrement and return */
    if (pxNotify->ulValue > 0) {
        TaskNotification_t ulVal = pxNotify->ulValue;
        pxNotify->ulValue -= 1;
        if (pxNotify->ulValue == 0) {
            pxNotify->eState = eNoNotification;
        }
        return ulVal;
    }

    /* Non-blocking */
    if (xTicksToWait == 0) {
        return 0;
    }

    /* Block until a notification arrives */
    pxTCB->state = TaskState BLOCKED;
    pxTCB->lock_type = LOCK_EVENT_NOTIFY;
    pxTCB->lock_arg = NULL;
    pxTCB->wake_tick = xTaskGetTickCount() + xTicksToWait;

    vTaskAddToBlockedList(pxTCB);

    if (xTaskGetSchedulerState() == taskSCHEDULER_RUNNING) {
        *SCB_ICSR_PENDSVSET_Msk |= SCB_ICSR_PENDSVSET_Msk;
    }

    /* Return value will be set when the task is woken */
    return 0;
}
