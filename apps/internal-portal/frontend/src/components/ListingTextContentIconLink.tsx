import { IconButton, Tooltip } from '@mui/material'
import { GridColDef, GridValidRowModel } from '@mui/x-data-grid'
import TextSnippet from '@mui/icons-material/TextSnippet'
import PostAddOutlined from '@mui/icons-material/PostAddOutlined'
import { Link } from 'react-router-dom'

// Result of the bulk existence lookup, as returned by
// useListingTextContentExistence.
export interface ListingTextContentExistence {
  // undefined = existence unknown (loading or error)
  hasTextContent: (rentalObjectCode: string) => boolean | undefined
  isError: boolean
}

export interface ListingTextContentIconLinkProps {
  rentalObjectCode: string
  existence: ListingTextContentExistence
}

// Icon link to the listing text ("annonsinnehåll") editor for a rental
// object: filled icon -> edit existing text, outlined icon -> create new.
export const ListingTextContentIconLink = (
  props: ListingTextContentIconLinkProps
) => {
  const { rentalObjectCode, existence } = props
  const hasContent = existence.hasTextContent(rentalObjectCode)
  const encodedCode = encodeURIComponent(rentalObjectCode)

  if (hasContent === undefined && !existence.isError) {
    return (
      <IconButton disabled>
        <PostAddOutlined />
      </IconButton>
    )
  }

  // When the lookup failed, fall back to the create view: it detects
  // existing content itself and offers a link to the editor.
  const to = hasContent
    ? `/annonsinnehall/${encodedCode}/redigera`
    : `/annonsinnehall/ny?code=${encodedCode}`

  const title = hasContent
    ? 'Redigera annonsinnehåll'
    : existence.isError
      ? 'Kunde inte kontrollera annonsinnehåll. Öppna för att skapa eller redigera'
      : 'Skapa annonsinnehåll'

  return (
    <Tooltip title={title}>
      <Link to={to}>
        <IconButton sx={{ color: 'black' }}>
          {hasContent ? <TextSnippet /> : <PostAddOutlined />}
        </IconButton>
      </Link>
    </Tooltip>
  )
}

// Narrow icon column shared by every table that lists rental objects.
export const getListingTextContentColumn = <
  R extends GridValidRowModel & { rentalObjectCode: string },
>(
  existence: ListingTextContentExistence
): GridColDef<R> => ({
  field: 'listing-text-content',
  headerName: '',
  sortable: false,
  filterable: false,
  flex: 0.3,
  disableColumnMenu: true,
  renderCell: ({ row }) => (
    <ListingTextContentIconLink
      rentalObjectCode={row.rentalObjectCode}
      existence={existence}
    />
  ),
})
