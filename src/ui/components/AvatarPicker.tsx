import { useId, useRef } from 'react';
import { Shuffle, Upload } from 'lucide-react';
import { AVATARS, getRandomAvatar } from '../utils/avatars';

interface AvatarPickerProps {
  value?: string;
  onChange: (next: string) => void;
  label?: string;
}

export const AvatarPicker = ({ value, onChange, label }: AvatarPickerProps) => {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="avatar-picker">
      {label && <div className="avatar-label">{label}</div>}
      <div className="avatar-current">
        <img src={value || AVATARS[0].data} alt="Avatar" />
      </div>
      <div className="avatar-actions">
        <button type="button" className="btn avatar-action" onClick={() => onChange(getRandomAvatar())}>
          <Shuffle size={16} /> Random
        </button>
        <button
          type="button"
          className="btn avatar-action"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} /> Upload
        </button>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload avatar image"
          title="Upload avatar image"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </div>
      <div className="avatar-grid">
        {AVATARS.map((avatar) => (
          <button
            type="button"
            key={avatar.id}
            className={`avatar-item ${value === avatar.data ? 'active' : ''}`}
            onClick={() => onChange(avatar.data)}
            title={avatar.label}
          >
            <img src={avatar.data} alt={avatar.label} />
          </button>
        ))}
      </div>
    </div>
  );
};
