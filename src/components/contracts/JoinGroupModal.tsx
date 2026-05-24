import { useState } from 'react'
import { Modal, Select, Typography, message } from 'antd'
import { mockContracts } from '@/data/mockData'

const { Text } = Typography

interface JoinGroupModalProps {
  open: boolean
  onClose: () => void
}

const groupOptions = Array.from(
  new Set(mockContracts.map(c => c.contractGroup).filter((g): g is string => Boolean(g?.trim())))
).map(g => ({ label: g, value: g }))

export default function JoinGroupModal({ open, onClose }: JoinGroupModalProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>()

  const handleConfirm = () => {
    if (!selectedGroup) return
    message.success(`Successfully joined group: ${selectedGroup}`)
    setSelectedGroup(undefined)
    onClose()
  }

  const handleCancel = () => {
    setSelectedGroup(undefined)
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Join Existing Group"
      onCancel={handleCancel}
      onOk={handleConfirm}
      okText="Confirm"
      cancelText="Cancel"
      okButtonProps={{ disabled: !selectedGroup, type: 'primary' }}
      width={480}
      centered
    >
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 6 }}>
          <span style={{ color: '#ff4d4f', marginRight: 3 }}>*</span>
          Select Group
        </Text>
        <Select
          value={selectedGroup}
          onChange={setSelectedGroup}
          placeholder="Search or select a group"
          style={{ width: '100%' }}
          showSearch
          options={groupOptions}
        />
      </div>
    </Modal>
  )
}
