/* ******************************************************************************
## HPCC SYSTEMS software Copyright (C) 2012 HPCC Systems®.  All rights reserved.
 ******************************************************************************/

IMPORT $ AS Tutorial;
EXPORT File_TutorialPerson := 
  DATASET('~tutorial::YN::TutorialPerson', {Tutorial.Layout_People, UNSIGNED8 fpos {virtual(fileposition)}}, THOR);
