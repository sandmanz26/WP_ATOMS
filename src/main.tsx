import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Table: {
            // headerColor matches the Leave module's own Figma table spec
            // (`components/table/component/headercolor`, `rgba(0,0,0,0.88)`)
            // — not an arbitrary gray.
            headerBg: '#fafafa',
            headerColor: 'rgba(0,0,0,0.88)',
            headerSplitColor: '#f0f0f0',
            rowHoverBg: '#f5f9ff',
            borderColor: '#f0f0f0',
          },
          Menu: {
            // Matches the Side Navbar component's own `h-[40px]` item row —
            // was 36, off by 4px against the actual Figma spec.
            itemHeight: 40,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
