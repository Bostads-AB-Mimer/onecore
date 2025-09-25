import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible'
import { CompanyList } from './CompanyList'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from '@/components/ui/Sidebar'
import { ChevronRight } from 'lucide-react'

export default function SidebarNavigation() {
  return (
    <Sidebar>
      <SidebarContent className="gap-0">
        <Collapsible
          key="companies"
          title="Companies"
          defaultOpen
          className="group/collapsible"
        >
          <SidebarGroup>
            <CollapsibleTrigger className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 mb-2">
              <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
              <div>Företag</div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <CompanyList />
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  )
}
