import { IconButton, Tooltip } from '@mui/material'
import { GridColDef, GridValidRowModel } from '@mui/x-data-grid'
import TextSnippet from '@mui/icons-material/TextSnippet'
import PostAddOutlined from '@mui/icons-material/PostAddOutlined'
import { Link, useLocation } from 'react-router-dom'

import { currentPath, FromState } from '../utils/navigationState'

export interface ListingTextContentIconLinkProps {
  rentalObjectCode: string
  // Listing.hasListingTextContent; undefined when the payload lacks the flag
  hasTextContent: boolean | undefined
}

// Icon link to the listing text ("annonsinnehåll") editor for a rental
// object: filled icon -> edit existing text, outlined icon -> create new.
export const ListingTextContentIconLink = (
  props: ListingTextContentIconLinkProps
) => {
  const { rentalObjectCode, hasTextContent } = props
  const location = useLocation()
  const encodedCode = encodeURIComponent(rentalObjectCode)

  // The editor's "Tillbaka" button returns to this origin instead of the
  // listing text search page.
  const state: FromState = { from: currentPath(location) }

  // When the flag is missing, fall back to the create view: it detects
  // existing content itself and offers a link to the editor.
  const to = hasTextContent
    ? `/annonsinnehall/${encodedCode}/redigera`
    : `/annonsinnehall/ny?code=${encodedCode}`

  const title = hasTextContent
    ? 'Redigera annonsinnehåll'
    : hasTextContent === undefined
      ? 'Kunde inte kontrollera annonsinnehåll. Öppna för att skapa eller redigera'
      : 'Skapa annonsinnehåll'

  return (
    <Tooltip title={title}>
      <Link to={to} state={state}>
        <IconButton sx={{ color: 'black' }}>
          {hasTextContent ? <TextSnippet /> : <PostAddOutlined />}
        </IconButton>
      </Link>
    </Tooltip>
  )
}

// Narrow icon column shared by every table that lists listings.
export const getListingTextContentColumn = <
  R extends GridValidRowModel & {
    rentalObjectCode: string
    hasListingTextContent?: boolean
  },
>(): GridColDef<R> => ({
  field: 'listing-text-content',
  headerName: '',
  sortable: false,
  filterable: false,
  flex: 0.3,
  disableColumnMenu: true,
  renderCell: ({ row }) => (
    <ListingTextContentIconLink
      rentalObjectCode={row.rentalObjectCode}
      hasTextContent={row.hasListingTextContent}
    />
  ),
})
