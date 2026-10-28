/**
 * semaphore.h — Synchronization Primitives for Cortex-M RTOS
 *
 * Binary Semaphore: ek event signal karne ke liye (ISR → Task, ya Task → Task)
 * Counting Semaphore: resource counting ya multiple events track karne ke liye
 *
 * Design: Mutex-free, ISR-safe, priority-ceiling optional, tick-aware timeout
 */

#ifndef CORTEX_RTOS_SEMAPHORE_H
#define CORTEX_RTOS_SEMAPHORE_H

#include "scheduler.h"  // tcb_t, TaskState

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Semaphore Types
 * ============================================================================ */

typedef struct binary_semaphore_s {
    uint32_t count;          /* 0 = taken, 1 = available (binary) */
    tcb_t *wait_list;        /* tasks blocked on this semaphore (FIFO) */
    const char *name;
} binary_semaphore_t;

typedef struct counting_semaphore_s {
    uint32_t count;          /* current available tokens */
    uint32_t max_count;      /* maximum tokens (capacity) */
    tcb_t *wait_list;        /* tasks blocked waiting for tokens */
    const char *name;
} counting_semaphore_t;

/* ============================================================================
 * Binary Semaphore API
 * ============================================================================ */

/**
 * Create a binary semaphore.  Initial count = 1 (available).
 * Returns NULL on allocation failure (out of TCB slots / memory).
 */
binary_semaphore_t *xBinarySemaphoreCreate(const char *name);

/**
 * Block the calling task on a binary semaphore.
 *   ticks_to_wait = number of ticks to wait (0 = no blocking, just check)
 *   Returns: pdTRUE  — semaphore obtained
 *            pdFALSE — timeout expired / not available
 *
 * ISR context: may be called from ISR; if a task is unblocked, PendSV is pended.
 */
int vBinarySemaphoreTake(binary_semaphore_t *pxSemaphore, uint32_t ticks_to_wait);

/**
 * Give (release) a binary semaphore.
 *   If a task is blocked on this semaphore, it is woken (moved READY).
 *   In ISR context, PendSV is pended if a higher-priority task was woken.
 *
 *   give_from_isr = pdTRUE if called from ISR context
 */
void vBinarySemaphoreGive(binary_semaphore_t *pxSemaphore, int give_from_isr);

/**
 * Give a binary semaphore from ISR context.  Returns pdTRUE if a task was
 * unblocked (caller should check if context switch is needed).
 */
int vBinarySemaphoreGiveFromISR(binary_semaphore_t *pxSemaphore);

/**
 * Reset a binary semaphore to its initial available state.
 * Any blocked tasks are moved back to the ready list (priority order).
 */
void vBinarySemaphoreFlush(binary_semaphore_t *pxSemaphore);

/**
 * Return the current count (0 or 1 for binary).
 */
static inline uint32_t uxBinarySemaphoreGetCount(const binary_semaphore_t *pxSemaphore)
{
    return pxSemaphore->count;
}

/* ============================================================================
 * Counting Semaphore API
 * ============================================================================ */

/**
 * Create a counting semaphore with given capacity (max_count).
 * Initial count = 0 (empty).
 */
counting_semaphore_t *xCountingSemaphoreCreate(const char *name,
                                                uint32_t max_count);

/**
 * Give (release) one token to a counting semaphore.
 * If count < max_count, increment count.
 * If tasks are blocked waiting, the highest-priority one is woken.
 *
 * give_from_isr = pdTRUE if called from ISR context
 */
void vCountingSemaphoreGive(counting_semaphore_t *pxSemaphore,
                             int give_from_isr);

/**
 * Take a token from a counting semaphore.
 *   ticks_to_wait = number of ticks to wait (0 = poll only)
 *   Returns: pdTRUE  — token obtained
 *            pdFALSE — timeout
 */
int vCountingSemaphoreTake(counting_semaphore_t *pxSemaphore,
                           uint32_t ticks_to_wait);

/**
 * Reset a counting semaphore: count = 0, all blocked tasks moved to READY.
 */
void vCountingSemaphoreFlush(counting_semaphore_t *pxSemaphore);

static inline uint32_t uxCountingSemaphoreGetCount(
    const counting_semaphore_t *pxSemaphore)
{
    return pxSemaphore->count;
}

#ifdef __cplusplus
}
#endif

#endif /* CORTEX_RTOS_SEMAPHORE_H */
