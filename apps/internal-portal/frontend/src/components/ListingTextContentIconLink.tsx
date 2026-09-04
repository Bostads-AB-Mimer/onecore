import { IconButton, Tooltip } from '@mui/material'
import TextSnippet from '@mui/icons-material/TextSnippet'
import PostAddOutlined from '@mui/icons-material/PostAddOutlined'
import { Link } from 'react-router-dom'

export interface ListingTextContentIconLinkProps {
  rentalObjectCode: string
  // undefined = existence unknown (loading or error) - renders disabled
  hasContent: boolean | undefined
}

// Icon link to the listing text ("annonsinnehåll") editor for a rental
// object: filled icon -> edit existing text, outlined icon -> create new.
export const ListingTextContentIconLink = (
  props: ListingTextContentIconLinkProps
) => {
  const { rentalObjectCode, hasContent } = props

  if (hasContent === undefined) {
    return (
      <IconButton disabled>
        <PostAddOutlined />
      </IconButton>
    )
  }

  const to = hasContent
    ? `/annonsinnehall/${rentalObjectCode}/redigera`
    : `/annonsinnehall/ny?code=${rentalObjectCode}`

  return (
    <Tooltip
      title={hasContent ? 'Redigera annonsinnehåll' : 'Skapa annonsinnehåll'}
    >
      <Link to={to}>
        <IconButton sx={{ color: 'black' }}>
          {hasContent ? <TextSnippet /> : <PostAddOutlined />}
        </IconButton>
      </Link>
    </Tooltip>
  )
}
