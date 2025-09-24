import { CompanyList } from './CompanyList'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from '@/components/ui/Sidebar'

export default function SidebarNavigation() {
  return (
    <Sidebar>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <CompanyList />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
