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
            headerBg: '#fafafa',
            headerColor: '#595959',
            headerSplitColor: '#f0f0f0',
            rowHoverBg: '#f5f9ff',
            borderColor: '#f0f0f0',
          },
          Menu: {
            itemHeight: 36,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
