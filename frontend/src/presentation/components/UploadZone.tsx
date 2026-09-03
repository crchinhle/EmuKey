import { Button, Upload } from 'antd';
import type { UploadProps } from 'antd';

interface UploadZoneProps {
  readonly accept: string;
  readonly buttonLabel: string;
  readonly helper: string;
  readonly label: string;
  readonly onSelect: (fileName: string) => void;
  readonly selectedFile: string | undefined;
}

export function UploadZone({
  accept,
  buttonLabel,
  helper,
  label,
  onSelect,
  selectedFile,
}: UploadZoneProps) {
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    onSelect(file.name);
    return false;
  };

  return (
    <div className="upload-zone">
      <strong>{label}</strong>
      <small>{selectedFile ?? helper}</small>
      <Upload
        accept={accept}
        beforeUpload={beforeUpload}
        maxCount={1}
        showUploadList={false}
      >
        <Button aria-label={buttonLabel}>{buttonLabel}</Button>
      </Upload>
    </div>
  );
}
