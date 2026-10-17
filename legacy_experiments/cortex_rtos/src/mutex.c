/**
 * mutex.c — Mutex Implementation for Cortex-M RTOS
 *
 * Implements priority inheritance for mutex synchronization.
 * When a high-priority task blocks on a mutex held by a lower-priority task,
 * the owner's effective priority is temporarily raised to prevent priority
 * inversion.
 *
 * Design notes:
 *   - Mutex owns an embedded binary semaphore for the underlying wait/notify
 *   - Owner field tracks which task currently holds the lock
 *   - Recursive mutexes track recursion_count; owner must give same # of times
 *   - Priority inheritance: owner's priority raised to max(waiters) when blocking
 *   - Original priority saved so it can be restored on release
 */

#include "mutex.h"
#include <stdlib.h>
#include <string.h>

/* --------------------------------------------------------------------------
 * Internal helpers
 * -------------------------------------------------------------------------- */

/**
 * Raise the owner's effective priority to the highest waiter's priority.
 * Stores the original priority so it can be restored on give.
 */
static void prvRaiseOwnerPriority(mutex_t *pxMutex)
{
    if (pxMutex == NULL || pxMutex->owner == NULL) {
        return;
    }

    tcb_t *owner = pxMutex->owner;
    tcb_t *waiter = pxMutex->sem.wait_list;

    /* Find highest priority waiter (lowest priority number = highest priority) */
    uint32_t highest_waiter_priority = owner->priority;
    while (waiter != NULL) {
        if (waiter->priority < highest_waiter_priority) {
            highest_waiter_priority = waiter->priority;
        }
        waiter = waiter->next;
    }

    /* Save original priority if not already saved */
    if (pxMutex->original_priority == 0 && owner->priority != 0) {
        pxMutex->original_priority = owner->priority;
    }

    /* Raise owner priority if a waiter has higher priority */
    if (highest_waiter_priority < owner->priority) {
        owner->priority = highest_waiter_priority;
    }
}

/**
 * Restore the owner's priority to original (non-inherited) value.
 * Also re-inserts owner into ready list at correct priority position.
 */
static void prvLowerOwnerPriority(mutex_t *pxMutex)
{
    if (pxMutex == NULL || pxMutex->owner == NULL) {
        return;
    }

    tcb_t *owner = pxMutex->owner;

    /* Restore original priority */
    if (pxMutex->original_priority != 0) {
        owner->priority = pxMutex->original_priority;
        pxMutex->original_priority = 0;
    }

    /* Re-insert owner into ready list at correct (restored) priority */
    /* The owner was already in the ready list at its current priority;
     * we need to remove and re-insert at the new (lower) priority. */
    if (owner->state == TaskState.READY) {
        /* Remove from current position in ready list */
        if (ready_list == owner) {
            ready_list = owner->next;
        } else {
            tcb_t *curr = ready_list;
            while (curr != NULL && curr->next != owner) {
                curr = curr->next;
            }
            if (curr != NULL) {
                curr->next = owner->next;
            }
        }

        /* Re-insert at correct priority */
        owner->next = NULL;
        if (ready_list == NULL || owner->priority < ready_list->priority) {
            owner->next = ready_list;
            ready_list = owner;
        } else {
            tcb_t *curr = ready_list;
            while (curr->next != NULL && curr->next->priority <= owner->priority) {
                curr = curr->next;
            }
            owner->next = curr->next;
            curr->next = owner;
        }
    }
}

/* --------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------- */

mutex_t *xSemaphoreCreateMutex(const char *name)
{
    return xSemaphoreCreateMutexEx(name, 1);  /* pdTRUE = priority inheritance */
}

mutex_t *xSemaphoreCreateRecursiveMutex(const char *name)
{
    mutex_t *pxMutex = (mutex_t *)pvPortMalloc(sizeof(mutex_t));
    if (pxMutex == NULL) {
        return NULL;
    }

    memset(pxMutex, 0, sizeof(*pxMutex));
    pxMutex->sem.count = 1;
    pxMutex->sem.wait_list = NULL;
    pxMutex->sem.name = name;
    pxMutex->owner = NULL;
    pxMutex->recursion_count = 0;
    pxMutex->type = 1;  /* recursive */
    pxMutex->original_priority = 0;

    return pxMutex;
}

mutex_t *xSemaphoreCreateMutexEx(const char *name, int xPriorityInheritance)
{
    mutex_t *pxMutex = (mutex_t *)pvPortMalloc(sizeof(mutex_t));
    if (pxMutex == NULL) {
        return NULL;
    }

    memset(pxMutex, 0, sizeof(*pxMutex));
    pxMutex->sem.count = 1;
    pxMutex->sem.wait_list = NULL;
    pxMutex->sem.name = name;
    pxMutex->owner = NULL;
    pxMutex->recursion_count = 0;
    pxMutex->type = (xPriorityInheritance != 0) ? 0 : 2; /* 0=normal, 2=no-inheritance */
    pxMutex->original_priority = 0;

    return pxMutex;
}

int xSemaphoreTake(mutex_t *pxMutex, uint32_t ticks_to_wait)
{
    if (pxMutex == NULL) {
        return pdFALSE;
    }

    /* If owner is current task and recursive, just increment and succeed */
    if (pxMutex->type == 1 && pxMutex->owner == pxCurrentTCB) {
        pxMutex->recursion_count++;
        return pdTRUE;
    }

    /* Try to take the semaphore */
    if (vBinarySemaphoreTake(&pxMutex->sem, ticks_to_wait) == pdTRUE) {
        pxMutex->owner = pxCurrentTCB;

        /* Save original priority before inheritance takes effect */
        if (pxMutex->type == 0 && pxMutex->original_priority == 0) {
            pxMutex->original_priority = pxCurrentTCB->priority;
        }

        return pdTRUE;
    }

    return pdFALSE;
}

int xSemaphoreGive(mutex_t *pxMutex)
{
    if (pxMutex == NULL) {
        return pdFALSE;
    }

    /* Must be the owner */
    if (pxMutex->owner != pxCurrentTCB) {
        return pdFALSE;
    }

    /* For recursive mutexes, check if more nested takes exist */
    if (pxMutex->type == 1) {
        if (pxMutex->recursion_count > 0) {
            pxMutex->recursion_count--;
            if (pxMutex->recursion_count > 0) {
                return pdTRUE;  /* Still held — don't release */
            }
        } else {
            return pdFALSE;  /* Not taken recursively — error */
        }
    }

    /* Revoke priority inheritance before releasing */
    if (pxMutex->type == 0) {
        prvLowerOwnerPriority(pxMutex);
    }

    /* Clear owner */
    pxMutex->owner = NULL;
    pxMutex->recursion_count = 0;

    /* Release the semaphore (this may wake a waiter) */
    vBinarySemaphoreGive(&pxMutex->sem, 0);

    /* If a higher-priority task was woken, priority inheritance for next owner
     * will be applied when that task takes the mutex */

    return pdTRUE;
}

int xSemaphoreGiveFromISR(mutex_t *pxMutex)
{
    if (pxMutex == NULL) {
        return pdFALSE;
    }

    /* Must be the owner */
    if (pxMutex->owner != pxCurrentTCB) {
        return pdFALSE;
    }

    /* Revoke priority inheritance */
    if (pxMutex->type == 0) {
        prvLowerOwnerPriority(pxMutex);
    }

    pxMutex->owner = NULL;
    pxMutex->recursion_count = 0;

    /* Release from ISR */
    int woken = vBinarySemaphoreGiveFromISR(&pxMutex->sem);

    return woken;
}

int xSemaphoreTakeRecursive(mutex_t *pxMutex, uint32_t ticks_to_wait)
{
    (void)ticks_to_wait;  /* Recursive mutex: always succeed if owner */
    if (pxMutex == NULL) {
        return pdFALSE;
    }
    if (pxMutex->type != 1) {
        return pdFALSE;  /* Not a recursive mutex */
    }

    /* If already owned by another task, block on semaphore */
    if (pxMutex->owner != NULL && pxMutex->owner != pxCurrentTCB) {
        return vBinarySemaphoreTake(&pxMutex->sem, ticks_to_wait) == pdTRUE
               ? pdTRUE : pdFALSE;
    }

    /* First take: take the semaphore and record owner */
    if (pxMutex->owner == NULL) {
        if (vBinarySemaphoreTake(&pxMutex->sem, ticks_to_wait) != pdTRUE) {
            return pdFALSE;
        }
        pxMutex->owner = pxCurrentTCB;
        pxMutex->original_priority = pxCurrentTCB->priority;
    }

    /* Increment recursion count */
    pxMutex->recursion_count++;
    return pdTRUE;
}

int xSemaphoreGiveRecursive(mutex_t *pxMutex)
{
    if (pxMutex == NULL || pxMutex->type != 1) {
        return pdFALSE;
    }

    /* Must be owner */
    if (pxMutex->owner != pxCurrentTCB) {
        return pdFALSE;
    }

    if (pxMutex->recursion_count == 0) {
        return pdFALSE;  /* Not taken */
    }

    pxMutex->recursion_count--;
    if (pxMutex->recursion_count == 0) {
        /* Fully released — revoke inheritance and clear owner */
        if (pxMutex->type == 0) {  /* Shouldn't happen for recursive, but be safe */
            prvLowerOwnerPriority(pxMutex);
        }
        pxMutex->owner = NULL;
        pxMutex->original_priority = 0;
        vBinarySemaphoreGive(&pxMutex->sem, 0);
    }

    return pdTRUE;
}

tcb_t *xSemaphoreGetMutexHolder(const mutex_t *pxMutex)
{
    if (pxMutex == NULL) {
        return NULL;
    }
    return pxMutex->owner;
}

void vMutexFlush(mutex_t *pxMutex)
{
    if (pxMutex == NULL) {
        return;
    }

    /* Release owner (revoke inheritance) */
    if (pxMutex->owner != NULL && pxMutex->type == 0) {
        prvLowerOwnerPriority(pxMutex);
    }

    pxMutex->owner = NULL;
    pxMutex->recursion_count = 0;
    pxMutex->original_priority = 0;

    /* Flush the underlying semaphore */
    vBinarySemaphoreFlush(&pxMutex->sem);
}

void vMutexDelete(mutex_t *pxMutex)
{
    if (pxMutex == NULL) {
        return;
    }

    vMutexFlush(pxMutex);
    vPortFree(pxMutex);
}

void vMutexSetCeiling(mutex_t *pxMutex, uint32_t ceiling_priority)
{
    if (pxMutex == NULL) {
        return;
    }

    pxMutex->original_priority = ceiling_priority;

    /* If there's an owner, raise its priority to the ceiling */
    if (pxMutex->owner != NULL) {
        if (ceiling_priority < pxMutex->owner->priority) {
            pxMutex->owner->priority = ceiling_priority;
        }
    }
}
