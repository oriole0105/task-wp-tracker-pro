import React from 'react';
import { CategoryManager } from '../components/CategoryManager';
import { UserManager } from '../components/UserManager';

const SettingsPage: React.FC = () => {
  return (
    <>
      <UserManager />
      <CategoryManager />
    </>
  );
};

export default SettingsPage;
