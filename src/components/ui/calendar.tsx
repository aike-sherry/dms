import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import * as React from 'react'
import { DayButton, DayPicker } from 'react-day-picker'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('relative w-fit select-none p-3', className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'flex w-full flex-col gap-2',
        nav: 'pointer-events-none absolute inset-x-3 top-3 flex h-8 items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'pointer-events-auto h-7 w-7 rounded-md p-0 text-slate-400 hover:bg-teal-50 hover:text-teal-600'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'pointer-events-auto h-7 w-7 rounded-md p-0 text-slate-400 hover:bg-teal-50 hover:text-teal-600'
        ),
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-semibold text-slate-800',
        dropdowns: 'flex h-8 items-center justify-center gap-1.5',
        dropdown_root: 'relative rounded-md border border-slate-200 text-sm',
        dropdown: 'absolute inset-0 opacity-0',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 pb-1 text-center text-[11px] font-medium text-slate-400',
        week: 'mt-1 flex',
        week_number_header: 'w-9',
        week_number: 'text-xs text-slate-400',
        day: 'h-9 w-9 p-0 text-center',
        day_button: cn(
          'h-9 w-9 rounded-lg text-sm font-normal text-slate-700 transition-colors',
          'hover:bg-teal-50 hover:text-teal-700',
          'data-[selected-single=true]:bg-teal-500 data-[selected-single=true]:font-semibold data-[selected-single=true]:text-white data-[selected-single=true]:shadow-sm data-[selected-single=true]:hover:bg-teal-600 data-[selected-single=true]:hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300'
        ),
        today: cn(
          '[&>button]:border [&>button]:border-teal-400 [&>button]:font-semibold [&>button]:text-teal-600',
          '[&>button[data-selected-single=true]]:border-transparent [&>button[data-selected-single=true]]:text-white'
        ),
        outside: '[&>button]:text-slate-300 [&>button]:hover:bg-teal-50 [&>button]:hover:text-teal-600',
        disabled: '[&>button]:text-slate-300 [&>button]:opacity-50 [&>button]:hover:bg-transparent',
        hidden: 'invisible',
        range_start: '[&>button]:rounded-l-lg',
        range_end: '[&>button]:rounded-r-lg',
        range_middle: '[&>button]:rounded-none',
        ...classNames,
      }}
      components={{
        Root: ({ className: c, rootRef, ...p }) => <div data-slot="calendar" ref={rootRef} className={cn(c)} {...p} />,
        Chevron: ({ className: c, orientation, ...p }) => {
          if (orientation === 'left') return <ChevronLeftIcon className={cn('h-4 w-4', c)} {...p} />
          if (orientation === 'right') return <ChevronRightIcon className={cn('h-4 w-4', c)} {...p} />
          return <ChevronDownIcon className={cn('h-4 w-4', c)} {...p} />
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...p }) => (
          <td {...p}>
            <div className="flex h-9 w-9 items-center justify-center text-center text-xs text-slate-400">{children}</div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle ? true : undefined}
      data-range-start={modifiers.range_start ? true : undefined}
      data-range-end={modifiers.range_end ? true : undefined}
      data-range-middle={modifiers.range_middle ? true : undefined}
      className={className}
      {...props}
    />
  )
}

export { Calendar }
