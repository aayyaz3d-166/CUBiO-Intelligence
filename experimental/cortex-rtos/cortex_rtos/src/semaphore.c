/**
 * semaphore.c — Synchronization Primitives Implementation
 *
 * Binary + Counting Semaphores with ISR-safe APIs, priority-ordered wake-up,
 * tick-based timeout, and integration with the scheduler's ready/blocked lists.
 */

#include "semaphore.h"
#include "scheduler.h"  /* tcb_t, TaskState, pxCurrentTCB, pxNextTCB,
                         * ready_list, blocked_list, g_system_ticks,
                         * scheduler_running, SCB_ICSR_PENDSVSET_Msk,
                         * vTaskIncrementTick, vTaskYield,
                         * _ready_insert, _ready_remove, _blocked_insert,
                         * _blocked_remove */
#include <string.h>
#include <stdlib.h>

/* ============================================================================
 * Internal helpers
 * ============================================================================ */

/**
 * Allocate and initialize a TCB for a blocked task.  The TCB is placed on
 * the calling task's stack conceptually — here we just malloc since this
 * is a host simulation.
 */
static tcb_t *create_blocked_tcb(const char *name, int priority)
{
    tcb_t *tcb = (tcb_t *)malloc(sizeof(tcb_t));
    if (tcb == NULL) {
        return NULL;
    }
    memset(tcb, 0, sizeof(tcb_t));
    tcb->state = TaskState.READY;
    tcb->priority = priority;
    tcb->name = name;
    tcb->time_slice = 10;
    tcb->ticks_used = 0;
    return tcb;
}

/**
 * Pend PendSV if we unblocked a task that has higher priority than the
 * currently running task (or if no task is running).
 */
static void maybe_pend_pendsv(tcb_t *woken_task)
{
    if (woken_task == NULL) {
        return;
    }

    /* If there's no running task, the woken task should run */
    if (pxCurrentTCB == NULL) {
        pxNextTCB = woken_task;
        return;
    }

    /* Priority-based preemption: lower number = higher priority */
    if (woken_task->priority < pxCurrentTCB->priority) {
        pxNextTCB = woken_task;
    }
}

/* ============================================================================
 * Binary Semaphore Implementation
 * ============================================================================ */

binary_semaphore_t *xBinarySemaphoreCreate(const char *name)
{
    binary_semaphore_t *pxSemaphore =
        (binary_semaphore_t *)malloc(sizeof(binary_semaphore_t));
    if (pxSemaphore == NULL) {
        return NULL;
    }
    memset(pxSemaphore, 0, sizeof(binary_semaphore_t));
    pxSemaphore->count = 1;              /* initially available */
    pxSemaphore->wait_list = NULL;
    pxSemaphore->name = name;
    return pxSemaphore;
}

int vBinarySemaphoreTake(binary_semaphore_t *pxSemaphore,
                          uint32_t ticks_to_wait)
{
    if (pxSemaphore == NULL) {
        return 0;  /* pdFALSE */
    }

    /* If semaphore is available, take it immediately */
    if (pxSemaphore->count > 0) {
        pxSemaphore->count = 0;
        return 1;  /* pdTRUE */
    }

    /* No token available — block the calling task */
    if (pxCurrentTCB == NULL) {
        return 0;  /* pdFALSE — no task to block */
    }

    if (ticks_to_wait == 0) {
        /* Polling: don't block, just return failure */
        return 0;  /* pdFALSE */
    }

    /* Block the current task on this semaphore's wait list */
    pxCurrentTCB->state = TaskState.BLOCKED;
    pxCurrentTCB->wake_tick = g_system_ticks + ticks_to_wait;

    /* Remove from ready list */
    _ready_remove(pxCurrentTCB);

    /* Insert into semaphore's wait list (priority order, lower number = higher) */
    pxCurrentTCB->next = NULL;  /* TCB next ptr used for wait_list linkage */
    if (pxSemaphore->wait_list == NULL ||
        pxCurrentTCB->priority < pxSemaphore->wait_list->priority) {
        pxCurrentTCB->next = pxSemaphore->wait_list;
        pxSemaphore->wait_list = pxCurrentTCB;
    } else {
        tcb_t *curr = pxSemaphore->wait_list;
        while (curr->next != NULL &&
               curr->next->priority <= pxCurrentTCB->priority) {
            curr = curr->next;
        }
        pxCurrentTCB->next = curr->next;
        curr->next = pxCurrentTCB;
    }

    /* Move to scheduler's blocked list for tick-based timeout processing */
    _blocked_insert(pxCurrentTCB);

    /* Trigger context switch to next ready task */
    pxNextTCB = ready_list;
    if (pxNextTCB != NULL) {
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TaskState.RUNNING;
    }

    /* Pend PendSV so the switch actually happens */
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk;

    return 0;  /* pdFALSE — we blocked, will know if we got it on wake */
}

void vBinarySemaphoreGive(binary_semaphore_t *pxSemaphore, int give_from_isr)
{
    if (pxSemaphore == NULL) {
        return;
    }

    /* If there are tasks waiting on this semaphore, wake the highest-priority
       one and give them the token. */
    if (pxSemaphore->wait_list != NULL) {
        tcb_t *woken = pxSemaphore->wait_list;
        pxSemaphore->wait_list = woken->next;
        woken->next = NULL;

        /* Give the token to the woken task */
        pxSemaphore->count = 0;  /* token consumed by woken task */

        /* Move woken task to ready list */
        woken->state = TaskState.READY;
        woken->wake_tick = 0;
        _blocked_remove(woken);

        /* If waiting list is empty, semaphore becomes available for next
           non-blocking take. */
        if (pxSemaphore->wait_list == NULL) {
            pxSemaphore->count = 1;
        }

        _ready_insert(woken);

        /* Check if we need to context switch */
        maybe_pend_pendsv(woken);
        if (pxNextTCB != NULL) {
            pxCurrentTCB = pxNextTCB;
            pxCurrentTCB->state = TaskState.RUNNING;
        }
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk;
        return;
    }

    /* No tasks waiting — semaphore becomes available */
    pxSemaphore->count = 1;
}

int vBinarySemaphoreGiveFromISR(binary_semaphore_t *pxSemaphore)
{
    vBinarySemaphoreGive(pxSemaphore, 1);
    /* Return pdTRUE if a context switch is pending */
    return (pxNextTCB != NULL) ? 1 : 0;
}

void vBinarySemaphoreFlush(binary_semaphore_t *pxSemaphore)
{
    if (pxSemaphore == NULL) {
        return;
    }

    /* Move all blocked tasks to ready list (priority order) */
    tcb_t *curr = pxSemaphore->wait_list;
    pxSemaphore->wait_list = NULL;
    pxSemaphore->count = 1;  /* back to available */

    while (curr != NULL) {
        tcb_t *next = curr->next;
        curr->next = NULL;
        curr->state = TaskState.READY;
        curr->wake_tick = 0;
        _blocked_remove(curr);
        _ready_insert(curr);
        curr = next;
    }
}

/* ============================================================================
 * Counting Semaphore Implementation
 * ============================================================================ */

counting_semaphore_t *xCountingSemaphoreCreate(const char *name,
                                                 uint32_t max_count)
{
    if (max_count == 0) {
        return NULL;
    }

    counting_semaphore_t *pxSemaphore =
        (counting_semaphore_t *)malloc(sizeof(counting_semaphore_t));
    if (pxSemaphore == NULL) {
        return NULL;
    }
    memset(pxSemaphore, 0, sizeof(counting_semaphore_t));
    pxSemaphore->count = 0;          /* initially empty */
    pxSemaphore->max_count = max_count;
    pxSemaphore->wait_list = NULL;
    pxSemaphore->name = name;
    return pxSemaphore;
}

void vCountingSemaphoreGive(counting_semaphore_t *pxSemaphore,
                             int give_from_isr)
{
    if (pxSemaphore == NULL) {
        return;
    }

    if (pxSemaphore->count >= pxSemaphore->max_count) {
        /* Semaphore is full — cannot give more tokens */
        return;
    }

    pxSemaphore->count++;

    /* If there are tasks waiting, wake the highest-priority one */
    if (pxSemaphore->wait_list != NULL) {
        tcb_t *woken = pxSemaphore->wait_list;
        pxSemaphore->wait_list = woken->next;
        woken->next = NULL;

        /* Skip the token we just added — it's consumed by the woken task */
        pxSemaphore->count--;

        woken->state = TaskState.READY;
        woken->wake_tick = 0;
        _blocked_remove(woken);
        _ready_insert(woken);

        maybe_pend_pendsv(woken);
        if (pxNextTCB != NULL) {
            pxCurrentTCB = pxNextTCB;
            pxCurrentTCB->state = TaskState.RUNNING;
        }
        mock_icsr |= SCB_ICSR_PENDSVSET_Msk;
    }
}

int vCountingSemaphoreTake(counting_semaphore_t *pxSemaphore,
                           uint32_t ticks_to_wait)
{
    if (pxSemaphore == NULL) {
        return 0;  /* pdFALSE */
    }

    /* If token available, take it immediately */
    if (pxSemaphore->count > 0) {
        pxSemaphore->count--;
        return 1;  /* pdTRUE */
    }

    /* No token — block if requested */
    if (pxCurrentTCB == NULL) {
        return 0;
    }

    if (ticks_to_wait == 0) {
        return 0;  /* pdFALSE — poll failed */
    }

    /* Block the current task */
    pxCurrentTCB->state = TaskState.BLOCKED;
    pxCurrentTCB->wake_tick = g_system_ticks + ticks_to_wait;

    _ready_remove(pxCurrentTCB);

    /* Insert into counting semaphore's wait list (priority order) */
    pxCurrentTCB->next = NULL;
    if (pxSemaphore->wait_list == NULL ||
        pxCurrentTCB->priority < pxSemaphore->wait_list->priority) {
        pxCurrentTCB->next = pxSemaphore->wait_list;
        pxSemaphore->wait_list = pxCurrentTCB;
    } else {
        tcb_t *curr = pxSemaphore->wait_list;
        while (curr->next != NULL &&
               curr->next->priority <= pxCurrentTCB->priority) {
            curr = curr->next;
        }
        pxCurrentTCB->next = curr->next;
        curr->next = pxCurrentTCB;
    }

    _blocked_insert(pxCurrentTCB);

    /* Context switch */
    pxNextTCB = ready_list;
    if (pxNextTCB != NULL) {
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TaskState.RUNNING;
    }
    mock_icsr |= SCB_ICSR_PENDSVSET_Msk;

    return 0;  /* pdFALSE — blocked, will know on wake */
}

void vCountingSemaphoreFlush(counting_semaphore_t *pxSemaphore)
{
    if (pxSemaphore == NULL) {
        return;
    }

    tcb_t *curr = pxSemaphore->wait_list;
    pxSemaphore->wait_list = NULL;
    pxSemaphore->count = 0;

    while (curr != NULL) {
        tcb_t *next = curr->next;
        curr->next = NULL;
        curr->state = TaskState.READY;
        curr->wake_tick = 0;
        _blocked_remove(curr);
        _ready_insert(curr);
        curr = next;
    }
}

/* ============================================================================
 * Tick processing — wake semaphore-blocked tasks whose timeout expired
 * ============================================================================ */

/**
 * Called from vTaskIncrementTick: walk through all semaphore wait lists and
 * move tasks whose wake_tick has expired back to the ready list (they got
 * timeout, not the semaphore).
 */
void vSemaphoreProcessTimeouts(void)
{
    /* This is called by the scheduler tick function.
     * For now, the blocked_list mechanism handles timeout globally.
     * Semaphore-specific wait lists are checked here for tasks that
     * blocked with a timeout but are still on the semaphore's wait list
     * (not yet on the scheduler's blocked_list — actually they ARE on both).
     *
     * The scheduler's blocked_list already handles timeout wakeup.
     * This function is a no-op placeholder for future expansion where
     * semaphore wait lists need explicit timeout handling independent of
     * the scheduler's blocked list.
     */
}
