# React 19 Form Actions Specification

## Purpose
Migrate prediction forms from traditional React patterns to React 19 Form Actions with `useActionState`, maintaining all existing validation, error handling, and match locking behavior while improving form state management.

## Requirements

### Requirement: Form Actions Migration

Prediction forms SHALL use React 19 Form Actions for submission handling.

#### Scenario: Form Action for prediction submission
- GIVEN a user submits a prediction score
- WHEN the form is submitted
- THEN a React 19 Form Action is invoked
- AND form state is managed via `useActionState`

#### Scenario: Progressive enhancement
- GIVEN JavaScript is disabled in the browser
- WHEN the form is submitted
- THEN the form still works with traditional HTTP POST
- AND no functionality is lost

### Requirement: Action State Management

Form state SHALL be managed using `useActionState` for loading, error, and success states.

#### Scenario: Loading state during submission
- GIVEN a prediction is being saved
- WHEN the Form Action is processing
- THEN the form shows a loading indicator
- AND the submit button is disabled

#### Scenario: Error state handling
- GIVEN a prediction submission fails
- WHEN the Form Action returns an error
- THEN the error is displayed to the user
- AND the form remains in an editable state

### Requirement: Validation Preservation

All existing validation logic SHALL be preserved in the Form Action implementation.

#### Scenario: Score range validation
- GIVEN a user enters a score outside 0-99 range
- WHEN the form is submitted
- THEN validation fails with appropriate error message
- AND no database operation occurs

#### Scenario: Match locking validation
- GIVEN a match is locked (currentTime >= match_date)
- WHEN a prediction is submitted
- THEN validation fails with "match locked" error
- AND no database operation occurs

### Requirement: Match Locking Behavior

Form inputs SHALL be automatically disabled when matches are locked.

#### Scenario: Input disabling on lock
- GIVEN match start time has passed
- WHEN the component renders
- THEN prediction inputs are disabled with lock icon
- AND no form submission is possible

#### Scenario: Real-time lock detection
- GIVEN a match start time occurs while user is viewing
- WHEN the current time passes match_date
- THEN inputs immediately disable
- AND visual lock indicator appears

### Requirement: Backward Compatibility

Form Actions migration SHALL not break existing prediction functionality.

#### Scenario: Existing predictions remain editable
- GIVEN a user has existing predictions for upcoming matches
- WHEN the migration is deployed
- THEN all existing predictions remain accessible
- AND users can update them normally

#### Scenario: Score calculation unchanged
- GIVEN Form Actions are implemented
- WHEN predictions are saved
- THEN the scoring system (3-1-0 points) remains identical
- AND no regression in point calculation occurs