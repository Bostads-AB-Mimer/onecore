import {
  CheckboxProps,
  Checkbox as RadixUiCheckbox,
  CheckboxIndicator,
} from '@radix-ui/react-checkbox'
import { CheckIcon } from '@radix-ui/react-icons'

export const Checkbox = (props: CheckboxProps) => (
  <RadixUiCheckbox
    {...props}
    style={{
      height: 20,
      width: 20,
      borderWidth: 1,
      borderColor: 'black',
      borderRadius: 2,
    }}
  >
    <CheckboxIndicator>
      <CheckIcon />
    </CheckboxIndicator>
  </RadixUiCheckbox>
)
