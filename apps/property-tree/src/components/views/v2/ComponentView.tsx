import { useParams } from 'react-router-dom'
import ComponentHeader from '@/components/component/ComponentHeader'
import ComponentBasicInfo from '@/components/component/ComponentBasicInfo'
import ComponentDetailTabs from '@/components/component/ComponentDetailTabs'

export default function ComponentView() {
  const { componentId } = useParams<{ componentId: string }>()

  if (!componentId) {
    return <div>Component ID saknas</div>
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6">
      <ComponentHeader />
      <ComponentBasicInfo />
      <ComponentDetailTabs />
    </div>
  )
}
