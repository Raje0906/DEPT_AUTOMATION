import React from 'react';
import { useMagazine } from '../../contexts/MagazineContext';

import CoverEditor             from './editors/CoverEditor';
import MessageEditor           from './editors/MessageEditor';
import ToppersEditor           from './editors/ToppersEditor';
import EventsEditor            from './editors/EventsEditor';
import WorkshopEditor          from './editors/WorkshopEditor';
import LectureEditor           from './editors/LectureEditor';
import AchievementsEditor      from './editors/AchievementsEditor';
import CentreOfExcellenceEditor from './editors/CentreOfExcellenceEditor';
import StaffAchievementsEditor from './editors/StaffAchievementsEditor';
import FDPSTTPEditor           from './editors/FDPSTTPEditor';
import PublicationsEditor      from './editors/PublicationsEditor';

const EDITOR_MAP = {
  cover:            CoverEditor,
  message:          MessageEditor,
  toppers:          ToppersEditor,
  events:           EventsEditor,
  workshops:        WorkshopEditor,
  lectures:         LectureEditor,
  achievements:     AchievementsEditor,
  coe:              CentreOfExcellenceEditor,
  staffAchievements: StaffAchievementsEditor,
  fdpSttp:          FDPSTTPEditor,
  publications:     PublicationsEditor,
};

export default function SectionEditor() {
  const { activeSection } = useMagazine();
  const EditorComponent = EDITOR_MAP[activeSection];

  if (!EditorComponent) {
    return (
      <div className="flex items-center justify-center h-64 text-draft text-sm">
        Select a section from the left panel to begin editing.
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <EditorComponent />
    </div>
  );
}
