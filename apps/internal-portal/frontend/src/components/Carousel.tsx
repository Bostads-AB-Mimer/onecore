import { Box, Typography } from '@mui/material'
import { useSnapCarousel } from 'react-snap-carousel'
import { Link } from 'react-router-dom'

const Carousel = ({
  links,
}: {
  links?: Array<{
    link: string
    image?: string | undefined
    caption?: string | undefined
  }>
}) => {
  const { scrollRef, snapPointIndexes } = useSnapCarousel()

  return (
    <ul className="flex snap-x snap-mandatory overflow-x-auto" ref={scrollRef}>
      {links?.map((link, i) => (
        <li
          key={i}
          className="flex-shrink-0"
          style={{
            scrollSnapAlign: snapPointIndexes.has(i) ? 'start' : '',
          }}
        >
          <Box
            sx={{
              marginTop: 1,
              marginBottom: 2,
              marginRight: 2,
            }}
          >
            {link.link ? (
              <Link to={link.link}>
                {link.image ? (
                  <img src={link.image} width="240" alt={link.caption} />
                ) : (
                  <Typography variant="body1">{link.caption}</Typography>
                )}
              </Link>
            ) : link.image ? (
              <img src={link.image} width="240" alt={link.caption} />
            ) : (
              <Typography variant="body1">{link.caption}</Typography>
            )}
          </Box>
        </li>
      ))}
    </ul>
  )
}
export default Carousel
