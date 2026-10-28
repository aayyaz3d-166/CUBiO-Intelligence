/**
 * task_notification.h — Task Notification API (Cortex-M RTOS)
 *
 * Per-TCB notification values and states. Lightweight IPC mechanism
 * that avoids the overhead of full queues or semaphores.
 *
 * Mirror of FreeRTOS task notifications; compiled for host-side
 * simulation and ARM Cortex-M3/M4/M7 targets.
 */

#ifndef TASK_NOTIFICATION_H
#define TASK_NOTIFICATION_H

#include <stdint.h>
#include <stdbool.h>
#include "scheduler.h"
#include "port.h"

/* ==========================================================================
 * Notification action types (passed to xTaskNotify / xTaskNotifyFromISR)
 * ========================================================================== */

/** No action — notification value and state unchanged. */
#define eNoAction           0

/** Set bits in the notification value (OR). */
#define eSetBits            1

/** Increment the notification value by 1. */
#define eIncrement          2

/** Set the notification value, overwriting any previous value. */
#define eSetValueWithOverwrite  3

/** Set the notification value only if no notification is pending. */
#define eSetValueWithoutOverwrite 4

/* ==========================================================================
 * Notification state returned by xTaskNotifyAndQuery / xTaskNotifyWait
 * ========================================================================== */

/** No notification is pending for the task. */
#define eNoNotification     0

/** A notification is pending (value has been set/incremented). */
#define eNotified           1

/** Notification pending with OVERWRITE semantics. */
#define eOverwrite          2

/** Notification pending with INCREMENT semantics. */
#define eIncrement          3

/* ==========================================================================
 * Task notification value and state (per-TCB)
 * ========================================================================== */

typedef uint32_t TaskNotification_t;

typedef struct task_notification_t
{
    TaskNotification_t ulValue;           /**< Current notification value        */
    UBaseType_t        eState;           /**< eNoNotification / eNotified      */
} task_notification_t;

/* ==========================================================================
 * Notification API
 * ========================================================================== */

/**
 * Send a notification to a task.
 *
 * @param pxTaskToNotify   Handle to the task to notify.
 * @param ulValue          Value to use (action-dependent).
 * @param eAction          One of eNoAction / eSetBits / eIncrement /
 *                         eSetValueWithOverwrite / eSetValueWithoutOverwrite.
 * @param xTicksToWait     Time in ticks to wait for space (0 = non-blocking).
 * @return                 pdPASS on success, pdFAIL on timeout / no space.
 */
BaseType_t xTaskNotify(TaskHandle_t pxTaskToNotify,
                       TaskNotification_t ulValue,
                       UBaseType_t eAction,
                       TickType_t xTicksToWait);

/**
 * Send a notification from ISR context.
 *
 * @param pxTaskToNotify   Task to notify.
 * @param ulValue          Value to use (action-dependent).
 * @param eAction          Notification action.
 * @param pxHigherPriorityTaskWoken  Set to pdTRUE if a context switch is needed.
 * @return                 pdPASS or pdFAIL.
 */
BaseType_t xTaskNotifyFromISR(TaskHandle_t pxTaskToNotify,
                              TaskNotification_t ulValue,
                              UBaseType_t eAction,
                              BaseType_t *pxHigherPriorityTaskWoken);

/**
 * Send a notification and return the previous notification value.
 *
 * @param pxTaskToNotify   Target task.
 * @param ulValue          Value to use (action-dependent).
 * @param eAction          Notification action.
 * @param pulPreviousValue Output: previous notification value.
 * @param xTicksToWait     Wait time (0 = non-blocking).
 * @return                 pdPASS or pdFAIL.
 */
BaseType_t xTaskNotifyAndQuery(TaskHandle_t pxTaskToNotify,
                               TaskNotification_t ulValue,
                               UBaseType_t eAction,
                               TaskNotification_t *pulPreviousValue,
                               TickType_t xTicksToWait);

/**
 * Clear the notification value and return the previous value.
 *
 * @param pxTask           Task whose value to clear.
 * @return                 Previous notification value (0 if none).
 */
TaskNotification_t ulTaskNotifyValueClear(TaskHandle_t pxTask);

/**
 * Clear the notification state (pending flag) without changing value.
 *
 * @param pxTask           Task whose state to clear.
 * @return                 pdPASS if state was cleared, pdFAIL if none pending.
 */
BaseType_t xTaskNotifyStateClear(TaskHandle_t pxTask);

/**
 * Block the calling task until it receives a notification.
 *
 * @param pxTask           Task to wait on (usually pxCurrentTCB).
 * @param ulBitsToWaitFor  Bits to wait for (0 = wait for any notification).
 * @param pulNotificationValue Output: notification value at wake.
 * @param xTicksToWait     Timeout in ticks (0 = non-blocking).
 * @return                 pdPASS if notified, pdFAIL on timeout.
 */
BaseType_t xTaskNotifyWait(TaskHandle_t pxTask,
                           TaskNotification_t ulBitsToWaitFor,
                           TaskNotification_t *pulNotificationValue,
                           TickType_t xTicksToWait);

/**
 * Increment the notification value and wake the task if waiting.
 * (Equivalent to xTaskNotify with eIncrement.)
 *
 * @param pxTask           Target task.
 * @return                 pdPASS.
 */
BaseType_t xTaskNotifyGive(TaskHandle_t pxTask);

/**
 * Increment from ISR.
 *
 * @param pxTask           Target task.
 * @param pxHigherPriorityTaskWoken  Set if switch needed.
 * @return                 pdPASS or pdFAIL.
 */
BaseType_t xTaskNotifyGiveFromISR(TaskHandle_t pxTask,
                                  BaseType_t *pxHigherPriorityTaskWoken);

/**
 * Decrement / take the notification value (block if zero).
 *
 * @param pxTask           Task to take from (usually pxCurrentTCB).
 * @param xTicksToWait     Timeout (0 = non-blocking).
 * @return                 Notification value after decrement, or 0 on timeout.
 */
TaskNotification_t xTaskNotifyTake(TaskHandle_t pxTask,
                                    TickType_t xTicksToWait);

#endif /* TASK_NOTIFICATION_H */
