import {
  Typography,
  Divider,
  Box,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
} from '@mui/material'

import { useMaterialChoices } from './hooks/useMaterialOptions'
import {
  MaterialOptionGroup,
  RoomType,
  MaterialChoice,
} from '../../common/types'
import Carousel from '../../components/Carousel'

const MaterialChoices = () => {
  const { data } = useMaterialChoices({ apartmentId: '123' })
  const roomTypes = data?.data?.roomTypes

  return (
    <>
      <Box>
        <Typography variant="h1">Beställda materialval</Typography>
        <Typography variant="body1">
          Här är materialvalen för ditt boende
        </Typography>
        {roomTypes?.map((roomType: RoomType, i) => (
          <Box key={i}>
            <Divider />
            <Typography variant="h2">{roomType.name}</Typography>
            {roomType.materialOptionGroups
              ?.filter(
                (group) => group.type == 'Concept' && group.materialChoices
              )
              .map((materialOptionGroup: MaterialOptionGroup, i) => (
                <Box key={i}>
                  <Typography variant="body1">
                    {materialOptionGroup.name}
                  </Typography>
                  <Carousel
                    links={materialOptionGroup.materialChoices?.map(
                      (materialChoice: MaterialChoice) => {
                        return {
                          link:
                            '/materialval/detaljer/' +
                            roomType.roomTypeId +
                            '/' +
                            materialOptionGroup.materialOptionGroupId +
                            '/' +
                            materialChoice.materialOption?.materialOptionId,
                          image: materialChoice.materialOption?.coverImage
                            ? '/api/material-options/assets/' +
                              materialChoice.materialOption?.coverImage
                            : undefined,
                          caption: materialChoice.materialOption?.caption,
                        }
                      }
                    )}
                  ></Carousel>
                  {materialOptionGroup.materialChoices?.map(
                    (materialChoice: MaterialChoice, i: number) => (
                      <FormControlLabel
                        key={i}
                        control={<Checkbox disabled={true} checked={true} />}
                        label={materialChoice.materialOption?.caption}
                      ></FormControlLabel>
                    )
                  )}
                </Box>
              ))}
            {roomType.materialOptionGroups
              ?.filter((group) => group.type == 'SingleChoice')
              .map((materialOptionGroup: MaterialOptionGroup, i) => (
                <Box key={i}>
                  <RadioGroup
                    aria-labelledby="demo-radio-buttons-group-label"
                    name="radio-buttons-group"
                  >
                    {materialOptionGroup.materialChoices?.map(
                      (materialChoice: MaterialChoice, i) => (
                        <Box key={i}>
                          <FormControlLabel
                            control={<Radio checked={true} disabled={true} />}
                            label={
                              materialChoice.materialOption?.caption +
                              ' - ' +
                              materialChoice.materialOption?.materialOptionId
                            }
                            value={
                              materialChoice.materialOption?.materialOptionId
                            }
                          ></FormControlLabel>
                          {materialChoice.materialOption?.shortDescription}
                        </Box>
                      )
                    )}
                  </RadioGroup>
                </Box>
              ))}
            {roomType.materialOptionGroups
              ?.filter((group) => group.type == 'AddOn')
              .map((materialOptionGroup: MaterialOptionGroup, i) => (
                <Box key={i}>
                  <Typography variant="body1">
                    {materialOptionGroup.actionName}
                  </Typography>
                  {materialOptionGroup.materialChoices?.map(
                    (materialChoice: MaterialChoice, i) => (
                      <FormControlLabel
                        key={i}
                        control={<Checkbox checked={true} disabled={true} />}
                        label={
                          materialChoice.materialOption?.caption +
                          ' ' +
                          materialChoice.materialOption?.shortDescription
                        }
                      ></FormControlLabel>
                    )
                  )}
                </Box>
              ))}
          </Box>
        ))}
      </Box>
    </>
  )
}

export default MaterialChoices
