import {
  CheckboxProps,
  Checkbox as RadixUiCheckbox,
  CheckboxIndicator,
} from '@radix-ui/react-checkbox'

export const Checkbox = (props: CheckboxProps) => (
  <RadixUiCheckbox {...props}>
    <CheckboxIndicator />
  </RadixUiCheckbox>
)
