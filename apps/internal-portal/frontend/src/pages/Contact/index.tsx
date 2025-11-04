import { Box, Button, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import z from 'zod'

import { mdTheme } from '../../theme'
import { ContactCard } from './components/ContactCard'
import apiClient from '../../utils/api-client'
import { Contact } from '@onecore/types'
import { useProfile } from '../../common/hooks/useProfile'

const FormSchema = z.object({
  searchInput: z.string().nonempty('Kundnummer eller personnummer saknas'),
})

export function ContactPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchValue = searchParams.get('search')
  const [contactCode, setContactCode] = useState<string | null>(null)
  useProfile() // makeshift solution to force auth

  const { handleSubmit, register, formState, setError } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      searchInput: searchValue ?? '',
    },
  })

  useEffect(() => {
    if (searchValue) {
      resolveContactCode(searchValue)
    }
  }, [searchValue])

  const isContactCode = (query: string) => {
    const queryLower = query.toLowerCase()
    return queryLower.startsWith('p') || queryLower.startsWith('f')
  }

  const resolveContactCode = async (query: string) => {
    if (isContactCode(query)) {
      setContactCode(query)
      return
    }

    try {
      const contactResponse = await apiClient.get<{ content: Contact }>(
        `/contacts/by-pnr/${query}`
      )

      if (contactResponse.data.content?.contactCode) {
        setContactCode(contactResponse.data.content.contactCode)
      } else {
        setError('searchInput', {
          message: `Hittade ingen användare med personnummer ${query}`,
        })
      }
    } catch (error) {
      setError('searchInput', {
        message: `Hittade ingen användare med personnummer ${query}`,
      })
    }
  }

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setSearchParams({ search: data.searchInput })
  }

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
                placeholder="Sök kundnummer eller personnummer..."
                sx={formSx}
                {...register('searchInput')}
              />
              <Button variant="dark" type="submit">
                Sök
              </Button>
            </Box>
            {formState.errors.searchInput && (
              <Typography color="error">
                {formState.errors.searchInput.message}
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
