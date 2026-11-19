import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import type { HomeInsuranceRow } from '@/services/api/core/homeInsuranceService'

import { formatSek } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Calendar } from '@/shared/ui/Calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/Form'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import { useEndHomeInsurance } from '../hooks/useEndHomeInsurance'
import {
  type EndAction,
  endHomeInsuranceFormSchema,
  type EndHomeInsuranceFormValues,
  planEnd,
  toDay,
} from '../lib/homeInsuranceEnd'

type Props = {
  leaseId: string
  row: HomeInsuranceRow
  /** Mina sidor shows a lease to come without a home insurance row as insured. */
  isUpcomingLease: boolean
}

const actionLabels: Record<EndAction, string> = {
  cancel: 'Säg upp',
  'set-end': 'Ändra T.o.m.',
}

export function EndHomeInsuranceDialog({
  leaseId,
  row,
  isUpcomingLease,
}: Props) {
  const [open, setOpen] = useState(false)
  const endInsurance = useEndHomeInsurance()

  const form = useForm<EndHomeInsuranceFormValues>({
    resolver: zodResolver(endHomeInsuranceFormSchema(row)),
    defaultValues: { action: 'cancel' },
  })

  const action = form.watch('action')
  const endDate = form.watch('endDate')
  const willDelete =
    !!endDate && planEnd(row, toDay(endDate), action) === 'delete'

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      form.reset()
      endInsurance.reset()
    }
  }

  const onSubmit = (values: EndHomeInsuranceFormValues) => {
    endInsurance.mutate(
      {
        leaseId,
        rowId: row.rowId,
        endDate: toDay(values.endDate),
        action: values.action,
      },
      // The hook shows the outcome as a toast and reloads the rows, which
      // may have changed even after an error.
      { onSettled: () => handleOpenChange(false) }
    )
  }

  return (
    <Dialog
      open={open}
      // No closing while saving: the outcome would get lost.
      onOpenChange={(next: boolean) =>
        (next || !endInsurance.isPending) && handleOpenChange(next)
      }
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Säg upp / ändra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hemförsäkring</DialogTitle>
          <DialogDescription>
            Kontrakt {leaseId}: Fr.o.m. {row.from ?? '-'}, T.o.m.{' '}
            {row.to ?? 'tillsvidare'}, {formatSek(row.monthlyAmount)}/mån.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-2"
          >
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Åtgärd</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      form.clearErrors('endDate')
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(actionLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Sista dag (T.o.m.)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, 'd MMMM yyyy', { locale: sv })
                            : 'Välj datum'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {willDelete && (
              <Alert variant={isUpcomingLease ? 'destructive' : 'default'}>
                <AlertDescription>
                  Raden tas bort, eftersom sista dagen är på eller före
                  försäkringens Fr.o.m.
                  {isUpcomingLease &&
                    ' Kontraktet är kommande: Mina sidor kommer då att visa hyresgästen som försäkrad.'}
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={endInsurance.isPending}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={endInsurance.isPending}>
                {endInsurance.isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
