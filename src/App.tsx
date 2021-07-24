import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { WaveSurfer } from './Wavesurfer';

function App() {
  const [file, setFile] = useState<File>(null);
  const onDrop = useCallback(acceptedFiles => {
    setFile(acceptedFiles[0]);
    console.log(acceptedFiles[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1 });

  const renderContent = () => {
    if (!file) {
      return (
        <div {...getRootProps()} style={{ height: 300, border: '1px solid gray', padding: 20 }}>
          <input {...getInputProps()} />
          {
            isDragActive ?
              <p>Drop the files here ...</p> :
              <p>Drag 'n' drop some audio files here, or click to select files</p>
          }
        </div>
      );
    }
    return (
      <WaveSurfer file={file} />
    );
  };

  return (
    <div>
      <h2>Simple audio annotator</h2>
      {renderContent()}
      <br />
      <sub>&copy; 2021 Dani Biro</sub>
    </div>
  );
}

export default App;
