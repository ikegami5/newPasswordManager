import { createRoot } from 'react-dom/client';
import { applicationName } from '@newpm/core';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <main>
    <h1>{applicationName}</h1>
    <p>デスクトップの環境構築確認用画面です。</p>
    <p>パスワード生成・データ移行はまだ実装していません。</p>
  </main>,
);
