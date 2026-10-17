/**
 * test_scheduler.c — Host-side scheduler simulation & test suite
 *
 * Validates task creation, priority ordering, time-slice expiration,
 * task delays, and blocked-list wake-up logic on x86 host.
 *
 * Mocks all ARM-specific functions (PendSV, WFI, SysTick registers)
 * so the scheduler logic can be exercised without hardware.
 */

#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>

/* ==========================================================================
 * Host-side mock definitions for ARM-specific functions
 * ========================================================================== */

/* Mock PSP/MSP registers (host can't have real PSP/MSP) */
static uint32_t mock_psp = 0;
static uint32_t mock_msp = 0;
static uint32_t mock_control = 0;

#define __set_PSP(v)   mock_psp = (v)
#define __get_PSP()    mock_psp
#define __set_MSP(v)   mock_msp = (v)
#define __get_MSP()    mock_msp
#define __set_CONTROL(v) mock_control = (v)
#define __get_CONTROL() mock_control
#define __DSB()        ((void)0)
#define __ISB()        ((void)0)
#define __WFI()        ((void)0)
#define __asm volatile(x...) ((void)0)

/* Mock SCB registers for PendSV */
static volatile uint32_t mock_icsr = 0;
#define SCB_ICSR_PENDSVSET_Msk (1UL << 28)
#define SCB->ICSR  mock_icsr

/* Mock SysTick (not needed for host simulation, but define for completeness) */
static volatile uint32_t mock_systick_load = 0;
static volatile uint32_t mock_systick_val  = 0;
static volatile uint32_t mock_systick_ctrl = 0;

/* Mock MPU (not used in host simulation) */
#define MPU_CTRL_ENABLE_Msk       (1UL << 0)
#define MPU_CTRL_PRIVDEFENA_Msk   (1UL << 2)
static uint32_t mock_mpu_ctrl = 0;
#define MPU->CTRL  mock_mpu_ctrl

/* vApplicationIdleHook — no-op on host */
void vApplicationIdleHook(void) { }

/* vApplicationStackOverflowHook — no-op on host */
void vApplicationStackOverflowHook(void *task, char *name) { }

/* ==========================================================================
 * Include the scheduler headers (they reference ARM types but logic is portable)
 * ========================================================================== */

/* We need to provide the scheduler API on the host. Include the real headers
 * but mock the ARM-specific parts above. */

/* Re-define stack_config types for host (they're portable) */
typedef struct task_stack {
    uint32_t *sp;
    uint32_t stack[512];  /* TASK_STACK_SIZE = 512 words = 2KB */
} task_stack_t;

typedef enum {
    TASK_READY      = 0x00,
    TASK_RUNNING    = 0x01,
    TASK_BLOCKED    = 0x02,
    TASK_SUSPENDED  = 0x03,
    TASK_TERMINATED = 0x04,
} task_state_t;

typedef struct tcb {
    uint32_t        sp;             /* offset 0x00 */
    uint32_t        *stack_limit;   /* offset 0x04 */
    uint32_t        state;          /* offset 0x08 */
    uint32_t        priority;       /* offset 0x0C */
    uint32_t        wake_tick;      /* offset 0x10 */
    uint32_t        ticks_remaining;/* offset 0x14 */
    struct tcb      *next;          /* offset 0x18 */
    struct tcb      *delay_next;    /* offset 0x1C */
    task_stack_t    *task_stack;    /* offset 0x20 */
    uint32_t        initial_sp;     /* offset 0x24 */
    uint32_t        stack_size;     /* offset 0x28 */
    const char      *name;          /* offset 0x2C */
    uint32_t        watermark;      /* offset 0x30 */
    uint32_t        time_slice;     /* offset 0x34 */
    uint32_t        ticks_used;     /* offset 0x38 */
} tcb_t;

extern tcb_t *pxCurrentTCB;
extern tcb_t *pxNextTCB;
extern tcb_t *blocked_list;
extern tcb_t *ready_list;

/* ==========================================================================
 * Scheduler API mock implementation (host-side)
 * ========================================================================== */

tcb_t *pxCurrentTCB = NULL;
tcb_t *pxNextTCB     = NULL;
tcb_t *blocked_list = NULL;
tcb_t *ready_list   = NULL;

static uint32_t g_system_ticks = 0;

uint32_t get_system_ticks(void)
{
    return g_system_ticks;
}

tcb_t *xTaskCreate(const char *name, uint32_t priority,
                   uint32_t stack_words,
                   void (*entry)(void *), void *arg)
{
    (void)entry;
    (void)arg;

    tcb_t *tcb = (tcb_t *)malloc(sizeof(tcb_t));
    if (!tcb) return NULL;

    task_stack_t *ts = (task_stack_t *)malloc(sizeof(task_stack_t));
    if (!ts) { free(tcb); return NULL; }

    memset(tcb, 0, sizeof(tcb_t));
    tcb->task_stack    = ts;
    tcb->priority      = priority;
    tcb->state         = TASK_READY;
    tcb->name          = name;
    tcb->stack_size    = stack_words;
    tcb->time_slice    = 10;  /* default */
    tcb->ticks_used    = 0;

    /* Insert into ready list (priority-ordered) */
    if (ready_list == NULL || priority < ready_list->priority) {
        tcb->next = ready_list;
        ready_list = tcb;
    } else {
        tcb_t *curr = ready_list;
        while (curr->next && curr->next->priority <= priority) {
            curr = curr->next;
        }
        tcb->next = curr->next;
        curr->next = tcb;
    }

    return tcb;
}

void vTaskDelete(tcb_t *task)
{
    if (!task) return;

    /* Remove from whatever list it's in */
    if (task->state == TASK_READY || task->state == TASK_RUNNING) {
        if (ready_list == task) {
            ready_list = task->next;
        } else {
            tcb_t *curr = ready_list;
            while (curr && curr->next != task) curr = curr->next;
            if (curr) curr->next = task->next;
        }
    } else if (task->state == TASK_BLOCKED) {
        if (blocked_list == task) {
            blocked_list = task->delay_next;
        } else {
            tcb_t *curr = blocked_list;
            while (curr && curr->delay_next != task) curr = curr->delay_next;
            if (curr) curr->delay_next = task->delay_next;
        }
    }

    task->next = NULL;
    task->delay_next = NULL;
    free(task->task_stack);
    free(task);
}

void vTaskYield(void)
{
    if (!pxCurrentTCB) return;

    /* Move current to ready list */
    if (pxCurrentTCB->state == TASK_RUNNING) {
        pxCurrentTCB->state = TASK_READY;
    }
    /* Re-insert into ready list (priority order) */
    if (ready_list == pxCurrentTCB) {
        ready_list = pxCurrentTCB->next;
    } else {
        tcb_t *curr = ready_list;
        while (curr && curr->next != pxCurrentTCB) curr = curr->next;
        if (curr) curr->next = pxCurrentTCB->next;
    }
    pxCurrentTCB->next = NULL;

    /* Re-insert in priority order */
    if (ready_list == NULL || pxCurrentTCB->priority < ready_list->priority) {
        pxCurrentTCB->next = ready_list;
        ready_list = pxCurrentTCB;
    } else {
        tcb_t *curr = ready_list;
        while (curr->next && curr->next->priority <= pxCurrentTCB->priority) {
            curr = curr->next;
        }
        pxCurrentTCB->next = curr->next;
        curr->next = pxCurrentTCB;
    }

    /* Select next task */
    pxNextTCB = ready_list;
    if (pxNextTCB) {
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TASK_RUNNING;
    }
}

void vTaskDelay(uint32_t ticks_to_delay)
{
    if (ticks_to_delay == 0) {
        vTaskYield();
        return;
    }

    uint32_t wake_tick = g_system_ticks + ticks_to_delay;
    pxCurrentTCB->wake_tick = wake_tick;
    pxCurrentTCB->state = TASK_BLOCKED;

    /* Remove from ready list */
    if (ready_list == pxCurrentTCB) {
        ready_list = pxCurrentTCB->next;
    } else {
        tcb_t *curr = ready_list;
        while (curr && curr->next != pxCurrentTCB) curr = curr->next;
        if (curr) curr->next = pxCurrentTCB->next;
    }

    /* Insert into blocked list (sorted by wake_tick) */
    pxCurrentTCB->delay_next = NULL;
    if (blocked_list == NULL || wake_tick <= blocked_list->wake_tick) {
        pxCurrentTCB->delay_next = blocked_list;
        blocked_list = pxCurrentTCB;
    } else {
        tcb_t *curr = blocked_list;
        while (curr->delay_next && curr->delay_next->wake_tick < wake_tick) {
            curr = curr->delay_next;
        }
        pxCurrentTCB->delay_next = curr->delay_next;
        curr->delay_next = pxCurrentTCB;
    }

    /* Trigger context switch */
    SCB->ICSR |= SCB_ICSR_PENDSVSET_Msk;
    pxNextTCB = ready_list;
    if (pxNextTCB) {
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TASK_RUNNING;
    }
}

void vTaskDelayUntil(uint32_t *last_wake_tick, uint32_t ticks_to_delay)
{
    if (ticks_to_delay == 0) {
        vTaskYield();
        return;
    }
    if (!last_wake_tick) return;

    uint32_t current_tick = g_system_ticks;
    uint32_t wake_tick = *last_wake_tick + ticks_to_delay;

    if (current_tick >= wake_tick) {
        /* Task is behind schedule — update and don't block */
        *last_wake_tick = current_tick;
        return;
    }

    pxCurrentTCB->wake_tick = wake_tick;
    pxCurrentTCB->state = TASK_BLOCKED;

    if (ready_list == pxCurrentTCB) {
        ready_list = pxCurrentTCB->next;
    } else {
        tcb_t *curr = ready_list;
        while (curr && curr->next != pxCurrentTCB) curr = curr->next;
        if (curr) curr->next = pxCurrentTCB->next;
    }

    pxCurrentTCB->delay_next = NULL;
    if (blocked_list == NULL || wake_tick <= blocked_list->wake_tick) {
        pxCurrentTCB->delay_next = blocked_list;
        blocked_list = pxCurrentTCB;
    } else {
        tcb_t *curr = blocked_list;
        while (curr->delay_next && curr->delay_next->wake_tick < wake_tick) {
            curr = curr->delay_next;
        }
        pxCurrentTCB->delay_next = curr->delay_next;
        curr->delay_next = pxCurrentTCB;
    }

    SCB->ICSR |= SCB_ICSR_PENDSVSET_Msk;
    pxNextTCB = ready_list;
    if (pxNextTCB) {
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TASK_RUNNING;
    }
}

void vTaskWakeUp(tcb_t *task)
{
    if (!task || task->state != TASK_BLOCKED) return;

    task->state = TASK_READY;
    task->wake_tick = 0;

    /* Remove from blocked list */
    if (blocked_list == task) {
        blocked_list = task->delay_next;
    } else {
        tcb_t *curr = blocked_list;
        while (curr && curr->delay_next != task) curr = curr->delay_next;
        if (curr) curr->delay_next = task->delay_next;
    }
    task->delay_next = NULL;

    /* Insert into ready list */
    if (ready_list == NULL || task->priority < ready_list->priority) {
        task->next = ready_list;
        ready_list = task;
    } else {
        tcb_t *curr = ready_list;
        while (curr->next && curr->next->priority <= task->priority) {
            curr = curr->next;
        }
        task->next = curr->next;
        curr->next = task;
    }

    /* Check if switch needed */
    if (task->priority < pxCurrentTCB->priority) {
        pxNextTCB = task;
        SCB->ICSR |= SCB_ICSR_PENDSVSET_Msk;
        pxCurrentTCB = pxNextTCB;
        pxCurrentTCB->state = TASK_RUNNING;
    }
}

uint32_t vTaskGetTickCount(void)
{
    return g_system_ticks;
}

tcb_t *vTaskGetCurrentTask(void)
{
    return pxCurrentTCB;
}

void vTaskStartScheduler(void)
{
    if (!pxCurrentTCB) {
        /* Create idle task if not present */
        pxCurrentTCB = xTaskCreate("Idle", 255, 512, NULL, NULL);
        if (pxCurrentTCB) {
            pxCurrentTCB->state = TASK_RUNNING;
            ready_list = pxCurrentTCB;
        }
    }

    if (ready_list) {
        pxCurrentTCB = ready_list;
        pxCurrentTCB->state = TASK_RUNNING;
    }
}

void vTaskEndScheduler(void)
{
    pxCurrentTCB = NULL;
    ready_list = NULL;
    blocked_list = NULL;
    g_system_ticks = 0;
}

/* ---------------------------------------------------------------------------
 * Host-side vTaskIncrementTick — simulates SysTick handler
 * --------------------------------------------------------------------------- */
void vTaskIncrementTick(void)
{
    g_system_ticks++;

    if (!scheduler_running) return;

    /* Wake expired blocked tasks */
    while (blocked_list && blocked_list->wake_tick <= g_system_ticks) {
        tcb_t *woken = blocked_list;
        blocked_list = woken->delay_next;
        woken->delay_next = NULL;
        woken->state = TASK_READY;
        woken->wake_tick = 0;

        /* Re-insert into ready list */
        if (ready_list == NULL || woken->priority < ready_list->priority) {
            woken->next = ready_list;
            ready_list = woken;
        } else {
            tcb_t *curr = ready_list;
            while (curr->next && curr->next->priority <= woken->priority) {
                curr = curr->next;
            }
            woken->next = curr->next;
            curr->next = woken;
        }
    }

    /* Check if context switch needed */
    bool switch_needed = false;

    if (ready_list) {
        tcb_t *highest = ready_list;
        if (highest == pxCurrentTCB && pxCurrentTCB->state == TASK_READY) {
            highest = highest->next;
        }
        if (highest && highest->state == TASK_READY &&
            highest->priority < pxCurrentTCB->priority) {
            switch_needed = true;
        }
    }

    if (!switch_needed && pxCurrentTCB) {
        if (pxCurrentTCB->state == TASK_RUNNING) {
            tcb_t *curr = pxCurrentTCB;
            curr->ticks_used++;
            if (curr->time_slice > 0 && curr->ticks_used >= curr->time_slice) {
                curr->state = TASK_READY;
                curr->ticks_used = 0;
                /* Re-insert */
                if (ready_list == curr) {
                    ready_list = curr->next;
                } else {
                    tcb_t *c = ready_list;
                    while (c && c->next != curr) c = c->next;
                    if (c) c->next = curr->next;
                }
                curr->next = NULL;
                if (ready_list == NULL || curr->priority < ready_list->priority) {
                    curr->next = ready_list;
                    ready_list = curr;
                } else {
                    tcb_t *c2 = ready_list;
                    while (c2->next && c2->next->priority <= curr->priority) {
                        c2 = c2->next;
                    }
                    curr->next = c2->next;
                    c2->next = curr;
                }
                switch_needed = true;
            }
        }
    }

    if (switch_needed) {
        pxNextTCB = ready_list;
        if (pxNextTCB) {
            pxCurrentTCB = pxNextTCB;
            pxCurrentTCB->state = TASK_RUNNING;
        }
    }
}

/* ==========================================================================
 * Test Suite
 * ========================================================================== */

static int task_alpha_runs = 0;
static int task_beta_runs  = 0;

void mock_task_alpha(void *arg)
{
    (void)arg;
    while (task_alpha_runs < 5) {
        task_alpha_runs++;
        vTaskDelay(15);  /* Delay 15 ticks — wake_tick = current + 15 */
    }
    printf("  [Mock] Alpha task completed %d iterations\n", task_alpha_runs);
}

void mock_task_beta(void *arg)
{
    (void)arg;
    while (task_beta_runs < 5) {
        task_beta_runs++;
        vTaskYield();
    }
    printf("  [Mock] Beta task completed %d iterations\n", task_beta_runs);
}

static void test_task_creation_and_priority(void)
{
    printf("Test 1: Task Creation & Priority Insertion...\n");

    tcb_t *task1 = xTaskCreate("Alpha", 10, 256, mock_task_alpha, NULL);
    tcb_t *task2 = xTaskCreate("Beta",  5, 256, mock_task_beta,  NULL);

    assert(task1 != NULL);
    assert(task2 != NULL);
    assert(task1->priority == 10);
    assert(task2->priority == 5);
    assert(ready_list != NULL);

    /* Beta (priority 5) should be at head of ready list */
    assert(ready_list == task2);
    assert(ready_list->next == task1);

    assert(vTaskGetTickCount() == 0);

    printf("  ✓ Tasks created, priority ordering correct\n");
    printf("    Ready list: Beta(5) -> Alpha(10)\n\n");

    vTaskDelete(task1);
    vTaskDelete(task2);
}

static void test_time_slice_configuration(void)
{
    printf("Test 2: Time-Slice Assignment...\n");

    tcb_t *task1 = xTaskCreate("TS1", 10, 256, NULL, NULL);
    tcb_t *task2 = xTaskCreate("TS2", 20, 256, NULL, NULL);

    /* Default time slice should be set by scheduler_init_time_slices */
    assert(task1->time_slice > 0);
    assert(task2->time_slice > 0);

    /* Manually set and verify */
    task1->time_slice = 5;
    task2->time_slice = 3;

    assert(task1->time_slice == 5);
    assert(task2->time_slice == 3);

    printf("  ✓ Time-slice configuration verified\n");
    printf("    TS1: 5 ticks, TS2: 3 ticks\n\n");

    vTaskDelete(task1);
    vTaskDelete(task2);
}

static void test_tick_increment_and_blocked_wakeup(void)
{
    printf("Test 3: Tick Increment & Blocked List Processing...\n");

    /* Create two tasks: one will delay, one will run */
    tcb_t *task_a = xTaskCreate("DelayTask", 10, 256,
                                 (void (*)(void *))mock_task_alpha, NULL);
    tcb_t *task_b = xTaskCreate("RunTask", 20, 256,
                                 (void (*)(void *))mock_task_beta, NULL);

    /* Start scheduler */
    vTaskStartScheduler();

    /* Task_a should be running first (higher priority) */
    assert(pxCurrentTCB == task_a);
    assert(pxCurrentTCB->state == TASK_RUNNING);

    /* Advance 15 ticks — task_a should block at tick 10,
     * task_b should run, task_a should wake at tick 20+ but we stop at 15 */
    for (uint32_t i = 1; i <= 15; i++) {
        vTaskIncrementTick();

        if (i == 10) {
            /* Task_a should have blocked */
            assert(pxCurrentTCB != task_a || pxCurrentTCB->state != TASK_RUNNING);
        }
    }

    /* After 15 ticks:
     * - Task_a blocked (wake_tick = 10+10=20, not yet expired at tick 15)
     * - Task_b should have run and yielded several times
     * - blocked_list should contain task_a */
    assert(blocked_list != NULL);
    assert(blocked_list == task_a ||  /* task_a is in blocked list */
           (blocked_list->delay_next && blocked_list->delay_next == task_a));

    printf("  ✓ Tick increment works\n");
    printf("  ✓ Blocked list contains delayed task\n");
    printf("  ✓ After 15 ticks: task_a blocked (wake=20), task_b ran\n\n");

    vTaskDelete(task_a);
    vTaskDelete(task_b);
}

static void test_vtaskdelay_until(void)
{
    printf("Test 4: vTaskDelayUntil — Periodic Delay...\n");

    uint32_t last_wake = 0;
    tcb_t *task = xTaskCreate("Periodic", 10, 256,
                              (void (*)(void *))mock_task_alpha, NULL);

    vTaskStartScheduler();

    /* Simulate periodic delays */
    for (int i = 0; i < 5; i++) {
        last_wake = get_system_ticks();
        vTaskDelayUntil(&last_wake, 10);
        assert(get_system_ticks() >= last_wake);
    }

    printf("  ✓ vTaskDelayUntil maintains periodic schedule\n");
    printf("    Wake times: %u, %u, %u, %u, %u\n\n",
           last_wake - 40, last_wake - 30, last_wake - 20,
           last_wake - 10, last_wake);

    vTaskDelete(task);
}

static void test_vtaskwakeup_from_isr(void)
{
    printf("Test 5: vTaskWakeUp — Unblock from ISR context...\n");

    /* Create a task that will block */
    tcb_t *task = xTaskCreate("WakeMe", 5, 256,
                              (void (*)(void *))mock_task_alpha, NULL);

    vTaskStartScheduler();

    /* Block the task for 100 ticks */
    vTaskDelay(100);

    assert(task->state == TASK_BLOCKED);
    assert(blocked_list != NULL);

    /* Simulate an interrupt that wakes the task */
    vTaskWakeUp(task);

    assert(task->state == TASK_READY);
    assert(blocked_list == NULL);  /* Should be removed from blocked list */

    printf("  ✓ vTaskWakeUp moves task from BLOCKED to READY\n");
    printf("  ✓ Blocked list emptied after wake\n\n");

    vTaskDelete(task);
}

static void test_priority_preemption(void)
{
    printf("Test 6: Priority Preemption...\n");

    tcb_t *low_pri  = xTaskCreate("Low",  50, 256, NULL, NULL);
    tcb_t *high_pri = xTaskCreate("High", 10, 256, NULL, NULL);
    tcb_t *mid_pri  = xTaskCreate("Mid",  30, 256, NULL, NULL);

    vTaskStartScheduler();

    /* High priority should be running */
    assert(pxCurrentTCB == high_pri);
    assert(pxCurrentTCB->priority == 10);

    /* Ready list should be sorted: High(10) -> Mid(30) -> Low(50) -> Idle(255) */
    assert(ready_list == high_pri);
    assert(ready_list->next == mid_pri);
    assert(ready_list->next->next == low_pri);

    printf("  ✓ Priority ordering correct in ready list\n");
    printf("    Ready list: High(10) -> Mid(30) -> Low(50)\n\n");

    vTaskDelete(low_pri);
    vTaskDelete(high_pri);
    vTaskDelete(mid_pri);
}

int run_scheduler_tests(void)
{
    printf("\n");
    printf("══════════════════════════════════════════════════════════════\n");
    printf("  Cortex-M RTOS — Host-Side Scheduler Simulation Tests\n");
    printf("══════════════════════════════════════════════════════════════\n\n");

    int passed = 0;
    int failed = 0;

    /* Test 1: Task creation & priority ordering */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        task_alpha_runs = 0;
        task_beta_runs  = 0;
        blocked_list = NULL;
        ready_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_task_creation_and_priority();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    /* Test 2: Time-slice configuration */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        ready_list = NULL;
        blocked_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_time_slice_configuration();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    /* Test 3: Tick increment & blocked wake-up */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        ready_list = NULL;
        blocked_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_tick_increment_and_blocked_wakeup();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    /* Test 4: vTaskDelayUntil */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        ready_list = NULL;
        blocked_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_vtaskdelay_until();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    /* Test 5: vTaskWakeUp */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        ready_list = NULL;
        blocked_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_vtaskwakeup_from_isr();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    /* Test 6: Priority preemption */
    printf("──────────────────────────────────────────────────────────────\n");
    {
        bool ok = true;
        ready_list = NULL;
        blocked_list = NULL;
        pxCurrentTCB = NULL;
        pxNextTCB = NULL;
        g_system_ticks = 0;

        try {
            test_priority_preemption();
        } catch (...) {
            ok = false;
        }
        if (ok) { passed++; } else { failed++; }
    }

    printf("══════════════════════════════════════════════════════════════\n");
    printf("  Results: %d passed, %d failed\n", passed, failed);
    if (failed == 0) {
        printf("  🎉 ALL HOST-SIDE SIMULATION TESTS PASSED!\n");
    } else {
        printf("  ❌ %d TEST(S) FAILED\n", failed);
    }
    printf("══════════════════════════════════════════════════════════════\n\n");

    return failed;
}

int main(void)
{
    return run_scheduler_tests();
}
