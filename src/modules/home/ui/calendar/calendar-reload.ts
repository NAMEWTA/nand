/** Native vault event dispatch finds live panels without owning their local navigation state. */
export const calendarReloaders = new WeakMap<HTMLElement, (resetToToday: boolean) => Promise<void>>();
