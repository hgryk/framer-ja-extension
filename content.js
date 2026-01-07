// Framer 日本語化 Content Script

(function() {
  'use strict';

  // 処理中フラグ（無限ループ防止）
  let isProcessing = false;

  // デバウンス用タイマー
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 500; // 500ms待ってからまとめて処理

  // 翻訳をスキップする要素のセレクター（ユーザーコンテンツ・編集可能要素）
  const SKIP_SELECTORS = [
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'textarea',
    'input',
    'select',                        // ドロップダウン（テンプレート選択など）
    'option',                        // ドロップダウンのオプション
    '[contenteditable="true"]',
    '[data-framer-ja-skip]',
    // ユーザーコンテンツ（ページ名・レイヤー名など）
    '.t3suiwm',                      // ページ/レイヤー名
    '.editing',                      // 編集中の要素
    '.n17gpdk2',                     // レイヤー名コンテナ
    '[data-testid="page-row"] .t3suiwm',
    // キャンバス・プレビュー
    '[data-testid="canvas-iframe"]',
    '[data-testid="preview-iframe"]',
    'iframe',
    // プロジェクト名・URL
    '.t1fxejbk',                     // プロジェクトタイトル
    '.h112jo8h',                     // URL表示
    // 検索入力
    '.tarvkue',
    // プロパティパネルの編集可能な値
    '.phdad7q',                      // selectボックス
    '[class*="PropertyValue"]',     // プロパティ値
    '[class*="EditableText"]',      // 編集可能テキスト
    '.szey606',                      // 値表示フィールド
  ].join(',');

  // テキストノードを翻訳する
  function translateTextNode(node) {
    if (!node || !node.textContent) return;

    const originalText = node.textContent.trim();
    if (!originalText) return;

    // 日本語が既に含まれていたらスキップ（翻訳済みの可能性）
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(originalText)) {
      return;
    }

    // 完全一致を先にチェック
    if (TRANSLATIONS[originalText]) {
      node.textContent = node.textContent.replace(originalText, TRANSLATIONS[originalText]);
      return;
    }

    // フレーズ翻訳をチェック
    let text = node.textContent;
    let changed = false;

    for (const [phrase, translation] of Object.entries(PHRASE_TRANSLATIONS)) {
      if (text.includes(phrase)) {
        text = text.replace(new RegExp(escapeRegExp(phrase), 'g'), translation);
        changed = true;
      }
    }

    // 単語単位での翻訳
    for (const [word, translation] of Object.entries(TRANSLATIONS)) {
      const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
      if (regex.test(text)) {
        text = text.replace(regex, translation);
        changed = true;
      }
    }

    if (changed) {
      node.textContent = text;
    }
  }

  // 正規表現のエスケープ
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 要素内のテキストノードを翻訳
  function translateElement(element) {
    if (!element) return;
    if (element.matches && element.matches(SKIP_SELECTORS)) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (parent && parent.closest && parent.closest(SKIP_SELECTORS)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(translateTextNode);
  }

  // placeholder等の属性を翻訳
  function translateAttributes(element) {
    if (!element.querySelectorAll) return;

    const attrs = ['placeholder', 'title', 'aria-label'];

    attrs.forEach(attr => {
      element.querySelectorAll(`[${attr}]`).forEach(el => {
        const value = el.getAttribute(attr);
        if (!value) return;

        // 日本語が既に含まれていたらスキップ
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(value)) return;

        if (TRANSLATIONS[value]) {
          el.setAttribute(attr, TRANSLATIONS[value]);
        }
      });
    });
  }

  // ページ全体を翻訳（スキップリストで除外）
  function translatePage() {
    if (isProcessing) return;

    isProcessing = true;

    try {
      // body全体を翻訳（スキップ対象は除外される）
      translateElement(document.body);
      translateAttributes(document.body);
    } finally {
      isProcessing = false;
    }
  }

  // デバウンス付きで翻訳を実行
  function debouncedTranslate() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      translatePage();
    }, DEBOUNCE_DELAY);
  }

  // MutationObserverで動的な変更を監視
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      // 処理中なら無視（自分の変更を検知しない）
      if (isProcessing) return;

      // 変更があったらデバウンス付きで翻訳
      debouncedTranslate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // characterDataは監視しない（パフォーマンス改善）
      characterData: false
    });

    return observer;
  }

  // 初期化
  function init() {
    console.log('[Framer 日本語化] 拡張機能を読み込みました');

    // 初回翻訳（少し遅延させてFramerの初期化を待つ）
    setTimeout(() => {
      translatePage();
      // DOM変更の監視を開始
      observeDOM();
    }, 1000);
  }

  // DOMが準備できたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
