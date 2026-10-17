/**
 * mutex.h — Mutex Synchronization Primitive for Cortex-M RTOS
 *
 * Mutex inherits from binary semaphore but adds:
 *   - Ownership tracking (which task holds the lock)
 *   - Recursive locking (same task can take multiple times)
 *   - Priority inheritance (prevents priority inversion)
 *
 * Usage:
 *   mutex = xSemaphoreCreateMutex();
 *   xSemaphoreTake(mutex, ticks_to_wait);  // same API as semaphore
 *   xSemaphoreGive(mutex);
 *   xSemaphoreGiveRecursive(mutex);          // for recursive mutexes
 *
 * Priority inheritance is automatic: when a high-priority task blocks on
 * a mutex held by a low-priority task, the low-priority task's effective
 * priority is raised to match the highest waiter.
 */

#ifndef CORTEX_RTOS_MUTEX_H
#define CORTEX_RTOS_MUTEX_H

#include "scheduler.h"  // tcb_t, TaskState
#include "semaphore.h"  // binary_semaphore_t

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Mutex Types
 * ============================================================================ */

typedef struct mutex_s {
    binary_semaphore_t sem;   /* embedded binary semaphore base */
    tcb_t *owner;             /* task that currently holds the mutex (NULL if free) */
    uint32_t recursion_count; /* number of times owner has taken (for recursive mutexes) */
    uint8_t  type;            /* 0 = normal, 1 = recursive */
    uint32_t original_priority; /* owner's priority before inheritance */
} mutex_t;

/* ============================================================================
 * Mutex Creation
 * ============================================================================ */

/** Create a normal (non-recursive) mutex. Returns NULL on failure. */
mutex_t *xSemaphoreCreateMutex(const char *name);

/** Create a recursive mutex. Same task can take multiple times. */
mutex_t *xSemaphoreCreateRecursiveMutex(const char *name);

/** Create a mutex with explicit priority inheritance enabled/disabled.
 *  If xPriorityInheritance is pdFALSE, mutex behaves like a plain semaphore. */
mutex_t *xSemaphoreCreateMutexEx(const char *name,
                                  int xPriorityInheritance);

/* ============================================================================
 * Mutex Take (same API as semaphore take, but enforces ownership) 
 * ============================================================================ */

/**
 * Take a mutex.  If the mutex is already held by another task, the calling
 * task blocks and priority inheritance is applied to the owner.
 *
 * Returns pdTRUE if mutex obtained, pdFALSE if timeout.
 */
int xSemaphoreTake(mutex_t *pxMutex, uint32_t ticks_to_wait);

/**
 * Give (release) a mutex.  Must be called by the current owner.
 * If a higher-priority task was waiting, priority inheritance is revoked.
 *
 * Returns pdTRUE if released, pdFALSE if not owner (error).
 */
int xSemaphoreGive(mutex_t *pxMutex);

/**
 * Give a mutex from ISR context.  Returns pdTRUE if a task was unblocked.
 */
int xSemaphoreGiveFromISR(mutex_t *pxMutex);

/* ============================================================================
 * Recursive Mutex API
 * ============================================================================ */

/**
 * Take a recursive mutex.  Same task can call this multiple times;
 * must give the same number of times to fully release.
 */
int xSemaphoreTakeRecursive(mutex_t *pxMutex, uint32_t ticks_to_wait);

/**
 * Give a recursive mutex (decrement recursion count by 1).
 * Use xSemaphoreGive() to fully release.
 */
int xSemaphoreGiveRecursive(mutex_t *pxMutex);

/* ============================================================================
 * Mutex Query
 * ============================================================================ */

/** Return the current mutex owner (NULL if free). */
tcb_t *xSemaphoreGetMutexHolder(const mutex_t *pxMutex);

/** Return the recursion count (0 = free or non-recursive). */
static inline uint32_t uxMutexGetRecursionCount(const mutex_t *pxMutex)
{
    return pxMutex->recursion_count;
}

/** Return pdTRUE if this mutex is recursive. */
static inline int xMutexIsRecursive(const mutex_t *pxMutex)
{
    return pxMutex->type == 1;
}

/* ============================================================================
 * Priority Inheritance
 * ============================================================================ */

/** Return the original (non-inherited) priority of the mutex owner. */
static inline uint32_t uxMutexGetOriginalPriority(const mutex_t *pxMutex)
{
    return pxMutex->original_priority;
}

/**
 * Manually set the priority inheritance ceiling.  Used for priority-ceiling
 * protocol mutexes.  When set, the owner's priority is raised to at least
 * this value while holding the mutex.
 */
void vMutexSetCeiling(mutex_t *pxMutex, uint32_t ceiling_priority);

/* ============================================================================
 * Mutex Flush / Delete
 * ============================================================================ */

/** Reset a mutex: release owner, clear wait list, recursion = 0. */
void vMutexFlush(mutex_t *pxMutex);

/** Delete a mutex and free its memory. */
void vMutexDelete(mutex_t *pxMutex);

#ifdef __cplusplus
}
#endif

#endif /* CORTEX_RTOS_MUTEX_H */
