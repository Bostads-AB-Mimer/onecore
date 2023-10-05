import { Typography, Divider, Grid, Box } from '@mui/material'
import { 
    useCommittedChoices, 
    RoomType, 
    MaterialOptionGroup, 
    MaterialChoice, 
    MaterialOption } from './hooks/useCommittedChoices'

const MaterialChoiceDetails = (  ) => {

    const { data } = useCommittedChoices('406-091-08-0101');
    console.log(data);

    return (
        <>
          <Box style={{ padding: '1cm', margin: '1cm', width: '21cm', height: '29.7cm' }}>
            <Typography variant="h1">Apartment Choices</Typography>
            <Divider />
            <Typography variant="h2">Apartment ID: '406-091-08-0101'</Typography>
            {data?.map((roomType) => (
              <div key={roomType.roomTypeId}>
                <Typography variant="h3">{roomType.name}</Typography>
                {roomType.materialOptionGroups.map((group) => (
                  <div key={group.materialOptionGroupId}>
                    <Typography variant="h4">{group.name || 'Material Options'}</Typography>
                    {group.materialChoices.map((choice) => (
                      <div key={choice.materialChoiceId}>
                        {/* Display the choice details here */}
                        <Typography>
                          Choice ID: {choice.materialChoiceId}
                          {/* Add more choice details as needed */}
                        </Typography>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </Box>
        </>
      );
}

export default MaterialChoiceDetails
