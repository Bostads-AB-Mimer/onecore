import { Box, Typography, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useCommittedChoices, RoomType } from './hooks/useCommittedChoices';

const MaterialChoiceDetails = () => {
  const { data } = useCommittedChoices('406-091-08-0101');
  const roomTypes = data?.roomTypes as RoomType[];

  console.log('roomTypes', roomTypes);

  return (
    <>
      <Box style={{ padding: '1cm', margin: '1cm', width: '21cm', height: '29.7cm' }}>
        <Typography variant="h1">Materialval</Typography>
        <Divider />
        <Typography variant="h2">Lägenhetsid: '406-091-08-0101'</Typography>

        {roomTypes && Array.isArray(roomTypes) ? (
          roomTypes.map((roomType: RoomType) => (
            <div key={roomType.roomTypeId}>
              {typeof roomType === 'object' && roomType.name && (
                <Typography variant="h3">{roomType.name}</Typography>
              )}

              {roomType.materialOptionGroups.map((group) => (
                <div key={group.materialOptionGroupId}>
                  {typeof group === 'object' && group.name && (
                    <Typography variant="h4">{group.name || 'Material Options'}</Typography>
                  )}

                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Room Type</TableCell>
                          <TableCell>Choice ID</TableCell>
                          <TableCell>Material Option ID</TableCell>
                          <TableCell>Caption</TableCell>
                          <TableCell>Short Description</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {roomType.materialOptionGroups.map((group) =>
                          group.materialChoices.map((choice) => (
                            <TableRow key={choice.materialChoiceId}>
                              <TableCell>{roomType.name}</TableCell>
                              <TableCell>{choice.materialChoiceId}</TableCell>
                              <TableCell>{choice.materialOptionId}</TableCell>
                              <TableCell>
                                {group.materialOptions.find(
                                  (option) => option.materialOptionId === choice.materialOptionId
                                )?.caption || 'null'}
                              </TableCell>
                              <TableCell>
                                {group.materialOptions.find(
                                  (option) => option.materialOptionId === choice.materialOptionId
                                )?.shortDescription || 'null'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>
              ))}
            </div>
          ))
        ) : (
          <Typography>No data available</Typography>
        )}
      </Box>
    </>
  );
}

export default MaterialChoiceDetails;
