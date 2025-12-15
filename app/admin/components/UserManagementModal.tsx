import {
    Button,
    Group,
    Modal,
    PasswordInput,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Employee, User } from '@/lib/types';

type Props = {
    opened: boolean;
    onClose: () => void;
    employee: (Employee & { user?: User | null }) | null;
    onSuccess: () => void;
};

export function UserManagementModal({ opened, onClose, employee, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const hasUser = !!employee?.user;

    // Form for creating new user
    const createForm = useForm({
        initialValues: {
            loginId: '',
            password: '',
        },
        validate: {
            loginId: (value) => (value ? null : 'ログインIDは必須です'),
            password: (value) => (value ? null : 'パスワードは必須です'),
        },
    });

    // Form for resetting password
    const resetForm = useForm({
        initialValues: {
            password: '',
        },
        validate: {
            password: (value) => (value ? null : '新しいパスワードは必須です'),
        },
    });

    const handleCreateUser = async (values: typeof createForm.values) => {
        if (!employee) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: employee.id,
                    ...values,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'ユーザー作成に失敗しました');
            }

            notifications.show({
                title: '成功',
                message: 'ログインユーザーを作成しました',
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

    const handleResetPassword = async (values: typeof resetForm.values) => {
        if (!employee?.user) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users/${employee.user.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'パスワードリセットに失敗しました');
            }

            notifications.show({
                title: '成功',
                message: 'パスワードをリセットしました',
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
            title={`アカウント管理: ${employee?.name ?? ''}`}
            centered
        >
            {!hasUser ? (
                <form onSubmit={createForm.onSubmit(handleCreateUser)}>
                    <Stack>
                        <Text size="sm" c="dimmed">
                            この従業員にはログインアカウントがありません。新規作成してください。
                        </Text>
                        <TextInput
                            label="ログインID"
                            required
                            {...createForm.getInputProps('loginId')}
                        />
                        <PasswordInput
                            label="初期パスワード"
                            required
                            {...createForm.getInputProps('password')}
                        />
                        <Group justify="flex-end">
                            <Button type="submit" loading={loading}>
                                アカウント作成
                            </Button>
                        </Group>
                    </Stack>
                </form>
            ) : (
                <form onSubmit={resetForm.onSubmit(handleResetPassword)}>
                    <Stack>
                        <Text size="sm">
                            現在のログインID: <Text span fw={700}>{employee?.user?.loginId}</Text>
                        </Text>
                        <Text size="sm" c="dimmed">
                            パスワードを忘れた場合、ここでリセット（上書き）できます。
                        </Text>
                        <PasswordInput
                            label="新しいパスワード"
                            placeholder="新しいパスワードを入力"
                            required
                            {...resetForm.getInputProps('password')}
                        />
                        <Group justify="flex-end">
                            <Button type="submit" color="red" loading={loading}>
                                パスワードをリセット
                            </Button>
                        </Group>
                    </Stack>
                </form>
            )}
        </Modal>
    );
}
