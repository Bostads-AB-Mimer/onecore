import { ComponentCategoryFactory } from './component-category'
import { ComponentTypeFactory } from './component-type'
import { ComponentSubtypeFactory } from './component-subtype'
import { ComponentModelFactory } from './component-model'
import { ComponentFactory } from './component'
import { ComponentInstallationFactory } from './component-installation'

export const factory = {
  category: ComponentCategoryFactory,
  type: ComponentTypeFactory,
  subtype: ComponentSubtypeFactory,
  model: ComponentModelFactory,
  component: ComponentFactory,
  installation: ComponentInstallationFactory,
}

// Also export individual factories for direct imports if needed
export {
  ComponentCategoryFactory,
  ComponentTypeFactory,
  ComponentSubtypeFactory,
  ComponentModelFactory,
  ComponentFactory,
  ComponentInstallationFactory,
}
