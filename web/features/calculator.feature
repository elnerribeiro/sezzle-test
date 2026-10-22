Feature: Calculator
  As a user
  I want to evaluate expressions from a keypad
  So that I can calculate without leaving the page

  Scenario Outline: Calculator works across the supported shell sizes
    Given I open the calculator at <width> by <height>
    When I enter and calculate "2+3*4"
    Then I see the result "14"
    And the complete application shell fits the viewport
    And the Sezzle brand palette is applied
    And the attribution appears below the ready status in matching style

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |
      | 320   | 720    |

  Scenario: Division by zero has a recoverable error
    Given I open the calculator at 1366 by 768
    When I enter and calculate "8/0"
    Then I see a safe calculation error with a support reference
    When I clear the expression and calculate "8/2"
    Then I see the result "4"

  Scenario: Advanced operations work from the keypad
    Given I open the calculator at 1366 by 768
    When I enter the advanced expression using the keypad
    Then I see the result "17.25"

  Scenario: Keyboard shortcuts enter and submit an expression
    Given I open the calculator at 1366 by 768
    When I type and calculate expression "1+2*3" with the keyboard
    Then I see the result "7"

  Scenario: Shift+6 enters exponentiation from the keyboard
    Given I open the calculator at 1366 by 768
    When I type and calculate "2^3" using the exponent keyboard shortcut
    Then I see the result "8"
