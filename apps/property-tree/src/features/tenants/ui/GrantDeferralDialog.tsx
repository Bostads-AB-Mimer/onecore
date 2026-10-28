import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Invoice } from '@onecore/types'
import { format, startOfToday } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
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
import { Textarea } from '@/shared/ui/Textarea'

import { useUpdateInvoiceDeferral } from '../hooks/useUpdateInvoiceDeferral'
import {
  deferralErrorMessages,
  deferralFormSchema,
  type DeferralFormValues,
} from '../lib/invoiceDeferral'

type Props = {
  invoice: Invoice
  contactCode: string
}

export const GrantDeferralDialog = ({ invoice, contactCode }: Props) => {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const updateDeferral = useUpdateInvoiceDeferral()

  const form = useForm<DeferralFormValues>({
    resolver: zodResolver(deferralFormSchema),
    defaultValues: { reason: '' },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      form.reset()
      updateDeferral.reset()
    }
  }

  const onSubmit = (values: DeferralFormValues) => {
    updateDeferral.mutate(
      {
        invoiceId: invoice.invoiceId,
        contactCode,
        endDate: format(values.endDate, 'yyyy-MM-dd'),
        reason: values.reason,
      },
      {
        onSuccess: () => {
          handleOpenChange(false)
          toast({
            title: 'Anstånd registrerat',
            description:
              'Förfallodatumet har uppdaterats i Tenfast och Xledger.',
          })
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => e.stopPropagation()}
        >
          Bevilja anstånd
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Bevilja anstånd</DialogTitle>
          <DialogDescription>
            Faktura {invoice.invoiceId} – ange nytt förfallodatum. Anståndet
            registreras både i Tenfast och Xledger.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-2"
          >
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Nytt förfallodatum</FormLabel>
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
                        disabled={(date) => date < startOfToday()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anledning</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="T.ex. betalningsplan överenskommen med hyresgäst."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {updateDeferral.error && (
              <p className="text-sm text-destructive">
                {deferralErrorMessages[updateDeferral.error.code] ??
                  'Något gick fel.'}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={updateDeferral.isPending}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={updateDeferral.isPending}>
                {updateDeferral.isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
