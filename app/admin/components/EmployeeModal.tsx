import {
    Button,
    Group,
    Modal,
    NumberInput,
    PasswordInput,
    Select,
    Stack,
    TextInput,
    Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { Employee } from '@/lib/types';

type Props = {
    opened: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employee?: Employee | null; // If null, create mode
};

export function EmployeeModal({ opened, onClose, onSuccess, employee }: Props) {
    const [loading, setLoading] = useState(false);
    const isEdit = !!employee;

    const form = useForm({
        initialValues: {
            name: '',
            hourlyRate: 1000,
            role: 'EMPLOYEE',
            jobRole: 'STAFF',
            loginId: '',
            password: '',
        },
        validate: {
            name: (value) => (value ? null : '名前は必須です'),
            hourlyRate: (value) => (value > 0 ? null : '時給は正の数で入力してください'),
            loginId: (value) => (!isEdit && !value ? 'ログインIDは必須です' : null),
            password: (value) => (!isEdit && !value ? 'パスワードは必須です' : null),
        },
    });

    useEffect(() => {
        if (employee) {
            form.setValues({
                name: employee.name,
                hourlyRate: employee.hourlyRate,
                role: employee.role,
                jobRole: employee.jobRole,
                loginId: '', // Not editable here
                password: '', // Not editable here
            });
        } else {
            form.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employee, opened]);

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        try {
            const url = isEdit ? `/api/employees/${employee.id}` : '/api/employees';
            const method = isEdit ? 'PUT' : 'POST';

            const body = isEdit
                ? {
                    name: values.name,
                    hourlyRate: values.hourlyRate,
                    role: values.role,
                    jobRole: values.jobRole,
                }
                : values;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '操作に失敗しました');
            }

            notifications.show({
                title: '成功',
                message: isEdit ? '従業員情報を更新しました' : '従業員を作成しました',
                color: 'teal',
            });
            onSuccess();
            onClose();
        } catch (e) {
            notifications.show({
                title: 'エラー',
                message: e instanceof Error ? e.message : 'エラーが発生しました',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={isEdit ? '従業員情報の編集' : '新規従業員の登録'}
            centered
        >
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    <TextInput
                        label="名前"
                        placeholder="山田 太郎"
                        required
                        {...form.getInputProps('name')}
                    />
                    <NumberInput
                        label="時給"
                        min={0}
                        step={10}
                        required
                        {...form.getInputProps('hourlyRate')}
                    />
                    <Select
                        label="職務 (Job Role)"
                        data={[
                            { value: 'KITCHEN', label: 'キッチン' },
                            { value: 'HALL', label: 'ホール' },
                            { value: 'STAFF', label: 'スタッフ' },
                            { value: 'MANAGER', label: '店長' },
                        ]}
                        required
                        {...form.getInputProps('jobRole')}
                    />
                    <Select
                        label="システム権限"
                        description="管理画面へのアクセス権限"
                        data={[
                            { value: 'EMPLOYEE', label: '一般 (アクセス権なし)' },
                            { value: 'ADMIN', label: '管理者 (全機能アクセス可)' },
                        ]}
                        required
                        {...form.getInputProps('role')}
                    />

                    {!isEdit && (
                        <>
                            <Text size="sm" fw={500} mt="md">
                                ログインアカウント作成
                            </Text>
                            <TextInput
                                label="ログインID"
                                description="英数字推奨"
                                required
                                {...form.getInputProps('loginId')}
                            />
                            <PasswordInput
                                label="初期パスワード"
                                required
                                {...form.getInputProps('password')}
                            />
                        </>
                    )}

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button type="submit" loading={loading}>
                            {isEdit ? '更新する' : '登録する'}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
