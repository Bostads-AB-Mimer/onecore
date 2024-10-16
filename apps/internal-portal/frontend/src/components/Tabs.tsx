import { styled, Tab as MuiTab } from '@mui/material'
import { TabList } from '@mui/lab'

export const Tabs = styled(TabList)(() => ({
  '& .MuiTabs-indicator': {
    width: '100%',
    backgroundColor: 'black',
    height: '3px',
  },
}))

export const Tab = styled(MuiTab)(() => ({
  fontSize: 20,
  textTransform: 'uppercase',
  fontFamily: 'bisonBold',
  fontWeight: 900,
  cursor: 'pointer',
  letterSpacing: '-0.00833em',
  color: 'rgba(0, 0, 0, 0.5)',
  '&.Mui-selected': {
    color: 'rgba(0, 0, 0, 0.87)',
  },
  minWidth: '45px',
  paddingLeft: '0.4rem',
  paddingRight: '0.4rem',
  marginRight: '1rem',
}))
