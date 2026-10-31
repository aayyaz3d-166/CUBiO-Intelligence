/**
 * event_group.h — Event Group API (Cortex-M RTOS)
 *
 * 32-bit bitmasks that tasks can wait on, set, and clear.
 * Used for synchronising multiple tasks on complex event conditions.
 *
 * Mirror of FreeRTOS event groups; compiled for host-side simulation
 * and ARM Cortex-M3/M4/M7 targets.
 */

#ifndef EVENT_GROUP_H
#define EVENT_GROUP_H

#include <stdint.h>
#include <stdbool.h>
#include "scheduler.h"
#include "port.h"

/** Type for event group bit masks. */
typedef uint32_t EventBits_t;

/** Maximum number of usable bits in an event group (32-bit mask). */
#define EVENT_GROUP_MAX_BITS  (32)

/** Bit mask that excludes the top two bits (used internally for ISR safety). */
#define eventGET_BITS_ONLY_MASK  (0x3FFFFFFF)

/* ==========================================================================
 * Event group handle and wait-list entry
 * ========================================================================== */

/**
 * Event group object.
 *
 * uxEventBits       Current bit mask.
 * xWaitList         List of tasks waiting for bits (priority-ordered).
 */
typedef struct event_group_t
{
    EventBits_t       uxEventBits;
    TaskHandle_t      xWaitList;       /**< Head of waiting-task list       */
} event_group_t;

/* ==========================================================================
 * Wait-bit flags (passed to xEventGroupWaitBits)
 * ========================================================================== */

/** Wait for ALL specified bits to be set (AND semantics). */
#define EVENT_WAIT_FOR_ALL_BITS  0x01

/** Clear the specified bits on exit from xEventGroupWaitBits. */
#define EVENT_CLEAR_ON_EXIT      0x02

/** Do NOT clear any bits on exit (default: bits remain set). */
#define EVENT_DO_NOT_CLEAR       0x00

/* ==========================================================================
 * Event group API
 * ========================================================================== */

/**
 * Create an event group.
 *
 * @return  Handle to the new event group, or NULL on failure.
 */
event_group_t *xEventGroupCreate(void);

/**
 * Delete an event group.  Wakes all tasks waiting on it.
 *
 * @param xEventGroup  Handle to delete.
 */
void vEventGroupDelete(event_group_t *xEventGroup);

/**
 * Set bits in an event group.  Wakes any tasks waiting for those bits.
 *
 * @param xEventGroup  Handle.
 * @param uxBitsToSet  Bits to set (ORed into uxEventBits).
 * @return             The previous value of uxEventBits.
 */
EventBits_t xEventGroupSetBits(event_group_t *xEventGroup,
                                EventBits_t uxBitsToSet);

/**
 * Set bits from ISR context.  May set *pxHigherPriorityTaskWoken.
 *
 * @param xEventGroup                 Handle.
 * @param uxBitsToSet                 Bits to set.
 * @param pxHigherPriorityTaskWoken  Output: pdTRUE if switch needed.
 * @return                           Previous uxEventBits value.
 */
EventBits_t xEventGroupSetBitsFromISR(event_group_t *xEventGroup,
                                       EventBits_t uxBitsToSet,
                                       BaseType_t *pxHigherPriorityTaskWoken);

/**
 * Clear bits in an event group.  Does NOT wake waiters (bits simply removed).
 *
 * @param xEventGroup   Handle.
 * @param uxBitsToClear Bits to clear (ANDed out of uxEventBits).
 * @return              Previous uxEventBits value.
 */
EventBits_t xEventGroupClearBits(event_group_t *xEventGroup,
                                  EventBits_t uxBitsToClear);

/**
 * Clear bits from ISR context.
 *
 * @param xEventGroup   Handle.
 * @param uxBitsToClear Bits to clear.
 * @return              Previous uxEventBits value.
 */
EventBits_t xEventGroupClearBitsFromISR(event_group_t *xEventGroup,
                                         EventBits_t uxBitsToClear);

/**
 * Wait for bits in an event group.
 *
 * @param xEventGroup          Handle.
 * @param uxBitsToWaitFor      Bits to wait for (AND if wait_for_all, OR otherwise).
 * @param xFlags               EVENT_WAIT_FOR_ALL_BITS | EVENT_CLEAR_ON_EXIT.
 * @param pxEventGroupValue    Output: event group value at time of return.
 * @param xTicksToWait         Timeout in ticks (0 = non-blocking).
 * @return                     pdPASS if condition met, pdFAIL on timeout.
 */
BaseType_t xEventGroupWaitBits(event_group_t *xEventGroup,
                               EventBits_t uxBitsToWaitFor,
                               UBaseType_t xFlags,
                               EventBits_t *pxEventGroupValue,
                               TickType_t xTicksToWait);

/**
 * Synchronise: set bits, wait for bits, optionally clear on exit.
 * Atomically performs set + wait + optional clear.
 *
 * @param xEventGroup          Handle.
 * @param uxBitsToSet          Bits to set before waiting.
 * @param uxBitsToWaitFor      Bits to wait for after setting.
 * @param xFlags               EVENT_CLEAR_ON_EXIT if bits should be cleared.
 * @param xTicksToWait         Timeout (0 = non-blocking).
 * @return                     pdPASS if condition met, pdFAIL on timeout.
 */
BaseType_t xEventGroupSync(event_group_t *xEventGroup,
                           EventBits_t uxBitsToSet,
                           EventBits_t uxBitsToWaitFor,
                           UBaseType_t xFlags,
                           TickType_t xTicksToWait);

#endif /* EVENT_GROUP_H */
