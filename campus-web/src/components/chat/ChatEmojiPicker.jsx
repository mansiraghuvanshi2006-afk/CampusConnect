import EmojiPicker, { Theme } from "emoji-picker-react";

/**
 * Full emoji picker for the chat composer (emoji-picker-react).
 */
const ChatEmojiPicker = ({ onSelect, className = "" }) => {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 shadow-2xl ${className}`}
    >
      <EmojiPicker
        theme={Theme.DARK}
        onEmojiClick={(emojiData) => {
          onSelect?.(emojiData.emoji);
        }}
        width="100%"
        height={360}
        lazyLoadEmojis
        previewConfig={{ showPreview: false }}
        searchPlaceHolder="Search emoji…"
      />
    </div>
  );
};

export default ChatEmojiPicker;
