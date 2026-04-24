import EntityPage from '../components/EntityPage';

function Doctors() {
  return (
    <EntityPage
      title="Doctors"
      subtitle="Manage registered doctors who can issue prescriptions."
      endpoint="/doctors"
      idField="doctor_id"
      fields={[
        { name: 'first_name', label: 'First Name', required: true },
        { name: 'last_name', label: 'Last Name', required: true },
        { name: 'specialization', label: 'Specialization', hint: 'e.g. Cardiology, Orthopedics' },
        { name: 'contact', label: 'Contact Number' },
      ]}
      columns={[
        { key: 'doctor_id', label: 'ID' },
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'specialization', label: 'Specialization' },
        { key: 'contact', label: 'Contact' },
      ]}
    />
  );
}

export default Doctors;
