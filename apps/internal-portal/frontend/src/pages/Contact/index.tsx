import { Box, Button, TextField, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import z from 'zod'

import { mdTheme } from '../../theme'
import { ContactCard } from './components/ContactCard'

const FormSchema = z.object({
  contactCode: z.string().nonempty('Kundnummer saknas'),
})

export function Contact() {
  const [searchParams, setSearchParams] = useSearchParams()
  const contactCode = searchParams.get('contact_code')

  const { handleSubmit, register, formState } = useForm({
    resolver: zodResolver(FormSchema),
  })

  const onSubmit = (data: z.infer<typeof FormSchema>) =>
    setSearchParams({ contact_code: data.contactCode })

  return (
    <>
      <Typography variant="h1">Kundkort</Typography>
      <Box paddingY="1rem">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box display="flex" flexDirection="column" rowGap={0.5}>
            <Box display="flex" columnGap={1}>
              <TextField
                size="small"
                variant="outlined"
                placeholder="Sök kundnummer..."
                sx={formSx}
                {...register('contactCode')}
              />
              <Button variant="dark" type="submit">
                Sök
              </Button>
            </Box>
            {formState.errors.contactCode && (
              <Typography color="error">
                {formState.errors.contactCode.message}
              </Typography>
            )}
          </Box>
        </form>
      </Box>
      {contactCode && <ContactCard contactCode={contactCode} />}
    </>
  )
}

const formSx = {
  width: '100%',
  maxWidth: 350,
  '& .MuiOutlinedInput-root': {
    fontSize: '16px',
    paddingTop: '2px',
    paddingBottom: '2px',
    color: '#000',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: mdTheme.palette.warmGrey.main,
      borderRadius: '6px',
      borderWidth: '1.5px',
    },
    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderWidth: '1.5px',
        borderColor: '#2e2e2e',
      },
    },
    '& .MuiInputLabel-outlined': {
      color: '#2e2e2e',
      '&.Mui-focused': {},
    },
  },
}
