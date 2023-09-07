import {
  Typography,
  Divider,
  Box,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
} from '@mui/material'
import { useState } from 'react'

import { useMaterialOptions } from './hooks/useMaterialOptions'
import {
  MaterialOptionGroup,
  MaterialOption,
  RoomType,
} from '../../common/types'
import DropDown from '../../components/DropDown'
import Carousel from '../../components/Carousel'

const MaterialOptions = () => {
  const [conceptChoices, setConceptChoices] = useState(
    Array<{
      materialOptionId: string
      materialOptionGroupId: string
      roomTypeId: string
    }>
  )

  const { data } = useMaterialOptions({ apartmentId: '123' })
  const roomTypes = data?.data?.roomTypes

  const defaultValue = '0'

  const save = () => {
    /* TODO: Save choices to apartment */
    console.log('conceptChoices', conceptChoices)
  }

  const saveChoiceToState = ({
    multipleChoice,
    materialOptionId,
    materialOptionGroupId,
    roomTypeId,
  }: {
    multipleChoice: boolean
    materialOptionId: string
    materialOptionGroupId: string
    roomTypeId: string
  }) => {
    const newChoices =
      conceptChoices.filter(
        (choice) =>
          multipleChoice ||
          choice.materialOptionGroupId != materialOptionGroupId
      ) ?? []

    newChoices.push({
      materialOptionId: materialOptionId,
      materialOptionGroupId: materialOptionGroupId,
      roomTypeId: roomTypeId,
    })

    setConceptChoices(newChoices)
  }

  const removeChoiceFromState = ({
    materialOptionGroupId,
    materialOptionId,
  }: {
    materialOptionGroupId?: string
    materialOptionId?: string
  }) => {
    const newChoices =
      conceptChoices.filter(
        (choice) =>
          (choice.materialOptionGroupId &&
            choice.materialOptionGroupId != materialOptionGroupId) ||
          (choice.materialOptionId &&
            choice.materialOptionId != materialOptionId)
      ) ?? []

    setConceptChoices(newChoices)
  }

  return (
    <>
      <Box>
        <Typography variant="h1">Dags för materialval</Typography>
        <Typography variant="body1">
          Det har nu blivit dags att göra materialval för ditt kommande boende!
        </Typography>
        {conceptChoices &&
          roomTypes?.map((roomType: RoomType, i) => (
            <Box key={i}>
              <Divider />
              <Typography variant="h2">{roomType.name}</Typography>
              {roomType.materialOptionGroups
                ?.filter((group) => group.type == 'Concept')
                .map((materialOptionGroup: MaterialOptionGroup, i) => (
                  <Box key={i}>
                    <Typography variant="body1">
                      {materialOptionGroup.name}
                    </Typography>
                    <Carousel
                      links={materialOptionGroup.materialOptions?.map(
                        (materialOption: MaterialOption) => {
                          return {
                            link:
                              materialOption.images ||
                              materialOption.description
                                ? '/materialval/detaljer/' +
                                  roomType.roomTypeId +
                                  '/' +
                                  materialOptionGroup.materialOptionGroupId +
                                  '/' +
                                  materialOption.materialOptionId
                                : '',
                            image:
                              '/api/material-options/assets/' +
                              materialOption.coverImage,
                            caption: materialOption.caption,
                          }
                        }
                      )}
                    ></Carousel>
                    {materialOptionGroup.materialOptions &&
                      materialOptionGroup.materialOptions.length > 1 && (
                        <DropDown
                          id={
                            roomType.roomTypeId +
                            '_' +
                            materialOptionGroup.materialOptionGroupId +
                            '_concept'
                          }
                          label={
                            materialOptionGroup.actionName ?? 'Välj alternativ'
                          }
                          defaultValue={defaultValue}
                          options={
                            materialOptionGroup.materialOptions?.map(
                              (materialOption: MaterialOption) => {
                                return {
                                  value: materialOption.materialOptionId,
                                  label: materialOption.caption,
                                }
                              }
                            ) ?? []
                          }
                          onSelect={(value: string) => {
                            // const newChoices =
                            //   conceptChoices.filter(
                            //     (choice) =>
                            //       choice.materialOptionGroupId !=
                            //       materialOptionGroup.materialOptionGroupId
                            //   ) ?? []

                            if (value == defaultValue) {
                              removeChoiceFromState({
                                materialOptionGroupId:
                                  materialOptionGroup.materialOptionGroupId,
                              })
                            } else {
                              saveChoiceToState({
                                multipleChoice: false,
                                materialOptionId: value,
                                materialOptionGroupId:
                                  materialOptionGroup.materialOptionGroupId,
                                roomTypeId: roomType.roomTypeId,
                              })
                            }

                            // if (value != defaultValue) {
                            //   newChoices.push({
                            //     materialOptionId: value,
                            //     materialOptionGroupId:
                            //       materialOptionGroup.materialOptionGroupId,
                            //     roomTypeId: materialOptionGroup.roomTypeId,
                            //   })
                            // }

                            // setConceptChoices(newChoices)
                          }}
                        />
                      )}
                  </Box>
                ))}
              {roomType.materialOptionGroups
                ?.filter((group) => group.type == 'SingleChoice')
                .map((materialOptionGroup: MaterialOptionGroup, i) => (
                  <Box key={i}>
                    <Typography variant="body1">
                      {materialOptionGroup.actionName}
                    </Typography>
                    <RadioGroup
                      aria-labelledby="demo-radio-buttons-group-label"
                      // defaultValue="female"
                      name="radio-buttons-group"
                      onChange={(
                        event: React.ChangeEvent<HTMLInputElement>
                      ) => {
                        const materialOptionId = (
                          event.target as HTMLInputElement
                        ).value

                        saveChoiceToState({
                          multipleChoice: false,
                          materialOptionId: materialOptionId,
                          materialOptionGroupId:
                            materialOptionGroup.materialOptionGroupId,
                          roomTypeId: roomType.roomTypeId,
                        })
                      }}
                    >
                      {materialOptionGroup.materialOptions?.map(
                        (materialOption: MaterialOption, i) => (
                          <Box key={i}>
                            <FormControlLabel
                              control={<Radio />}
                              label={
                                materialOption.caption +
                                ' - ' +
                                materialOption.materialOptionId
                              }
                              value={materialOption.materialOptionId}
                            ></FormControlLabel>
                            {materialOption.shortDescription}
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
                    {materialOptionGroup.materialOptions?.map(
                      (materialOption: MaterialOption, i) => (
                        <FormControlLabel
                          key={i}
                          control={
                            <Checkbox
                              onChange={(event, checked) => {
                                if (checked) {
                                  saveChoiceToState({
                                    multipleChoice: true,
                                    materialOptionId:
                                      materialOption.materialOptionId,
                                    materialOptionGroupId:
                                      materialOptionGroup.materialOptionGroupId,
                                    roomTypeId: roomType.roomTypeId,
                                  })
                                } else {
                                  removeChoiceFromState({
                                    materialOptionId:
                                      materialOption.materialOptionId,
                                  })
                                }
                              }}
                            />
                          }
                          label={
                            materialOption.caption +
                            ' ' +
                            materialOption.shortDescription
                          }
                        ></FormControlLabel>
                      )
                    )}
                  </Box>
                ))}
            </Box>
          ))}
        <Box sx={styles.actionContainer}>
          <Button variant="contained" onClick={save}>
            Spara materialval
          </Button>
        </Box>
      </Box>
    </>
  )
}

const styles = {
  actionContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
}

export default MaterialOptions
