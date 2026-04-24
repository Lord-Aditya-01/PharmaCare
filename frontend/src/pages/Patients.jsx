import EntityPage from '../components/EntityPage';

function Patients() {
  return (
    <EntityPage
      title="Customers"
      subtitle="Manage customer records for prescription tracking."
      endpoint="/patients"
      idField="patient_id"
      fields={[
        { name: 'first_name', label: 'First Name', required: true },
        { name: 'last_name', label: 'Last Name', required: true },
        { name: 'age', label: 'Age', type: 'number', hint: 'Customer age in years' },
        { name: 'gender', label: 'Gender', type: 'select', options: ['Male','Female','Other'] },
        { name: 'contact', label: 'Contact Number' },
      ]}
      columns={[
        { key: 'patient_id', label: 'ID' },
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'age', label: 'Age' },
        { key: 'gender', label: 'Gender' },
        { key: 'contact', label: 'Contact' },
      ]}
      clientValidate={(form) => {
        if (form.age !== undefined && form.age !== '') {
          const a = Number(form.age);
          if (!Number.isInteger(a) || a < 0 || a > 150) return 'Age must be a valid number between 0 and 150';
        }
        return null;
      }}
    />
  );
}

export default Patients;
