Feature: Calculator
  As a user
  I want to evaluate expressions from a keypad
  So that I can calculate without leaving the page

  Scenario Outline: Calculator works across the supported shell sizes
    Given I open the calculator at <width> by <height>
    When I enter and calculate "2+3*4"
    Then I see the result "14"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport
    And the Sezzle brand palette is applied
    And the attribution appears below the ready status in matching style

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |
      | 320   | 720    |

  Scenario Outline: Division by zero has a recoverable error at every desktop size
    Given I open the calculator at <width> by <height>
    When I enter and calculate "8/0"
    Then I see a safe calculation error with a support reference
    And visible calculator content stays within the card
    And the complete application shell fits the viewport
    When I clear the expression and calculate "8/2"
    Then I see the result "4"
    And visible calculator content stays within the card

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |

  Scenario Outline: Advanced operations work from the keypad at every desktop size
    Given I open the calculator at <width> by <height>
    When I enter the advanced expression using the keypad
    Then I see the result "17.25"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |

  Scenario Outline: Keyboard shortcuts enter and submit an expression at every desktop size
    Given I open the calculator at <width> by <height>
    When I type and calculate expression "1+2*3" with the keyboard
    Then I see the result "7"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |

  Scenario Outline: Shift+6 enters exponentiation from the keyboard at every desktop size
    Given I open the calculator at <width> by <height>
    When I type and calculate "2^3" using the exponent keyboard shortcut
    Then I see the result "8"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |

  Scenario Outline: Global keyboard shortcuts remain active after keypad input
    Given I open the calculator at <width> by <height>
    When I mix keypad input with the global x, S, Escape and equals shortcuts
    Then I see the result "5"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |

  Scenario Outline: Long results remain readable without horizontal overflow
    Given I open the calculator at <width> by <height>
    When I enter and calculate "2^100"
    Then I see the result "1.2676506002282294e+30"
    And visible calculator content stays within the card
    And the complete application shell fits the viewport

    Examples:
      | width | height |
      | 1080  | 1920   |
      | 1366  | 768    |
      | 1920  | 1080   |
      | 320   | 720    |
